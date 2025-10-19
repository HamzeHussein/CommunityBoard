#nullable enable
using System.Text;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using Microsoft.Data.Sqlite;

namespace WebApp;

public static class RestApi
{
    // === Validering ===
    private static readonly Regex SafeCategory = new(@"^[a-zA-Z0-9\s\-_]{1,64}$", RegexOptions.Compiled);
    private static readonly Regex SafeUsername = new(@"^[a-zA-Z0-9_\-\.]{3,32}$", RegexOptions.Compiled);
    private static readonly Regex EmailRegex = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);
    private static readonly Regex PhoneRegex = new(@"^\+?[0-9\s\-]{6,20}$", RegexOptions.Compiled);

    // === Databasplacering: backend/data/_db.sqlite3 ===
    private static string DbDir => Path.Combine(App.Environment.ContentRootPath, "data");
    private static string DbPath => Path.Combine(DbDir, "_db.sqlite3");

    private static void EnsureDbDirectory()
    {
        if (!Directory.Exists(DbDir)) Directory.CreateDirectory(DbDir);
    }

    private static SqliteConnection GetConn()
    {
        EnsureDbDirectory();
        var cs = new SqliteConnectionStringBuilder
        {
            DataSource = DbPath,
            Mode = SqliteOpenMode.ReadWriteCreate
        }.ToString();
        return new SqliteConnection(cs);
    }

    // === AUTH DTOs & Cookie ===
    private record AuthRequest(string username, string password);
    private record CurrentUser(string Username, string Role)
    {
        public bool IsAdmin => Role == "admin";
    }
    private const string AUTH_COOKIE = "auth";
    private static readonly byte[] SECRET = Encoding.UTF8.GetBytes("demo-secret"); // byt i skarp

    // === Cookie signering (HMAC) ===
    private static string Sign(string data)
    {
        using var h = new HMACSHA256(SECRET);
        var sig = Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(data)));
        return $"{data}|{sig}";
    }

    private static bool TryParseAuthCookie(string? cookie, out CurrentUser user)
    {
        user = new CurrentUser("", "");
        if (string.IsNullOrWhiteSpace(cookie)) return false;

        var parts = cookie.Split('|');
        if (parts.Length != 3) return false;
        var data = $"{parts[0]}|{parts[1]}";
        using var h = new HMACSHA256(SECRET);
        var expect = Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(data)));
        if (!expect.Equals(parts[2], StringComparison.OrdinalIgnoreCase)) return false;

        user = new CurrentUser(parts[0], parts[1]);
        return true;
    }

    private static bool TryGetUser(HttpContext ctx, out CurrentUser user)
    {
        var cookie = ctx.Request.Cookies[AUTH_COOKIE];
        return TryParseAuthCookie(cookie, out user);
    }

    // === Lösenordshashning (PBKDF2) ===
    // Format: pbkdf2$<iterations>$<saltB64>$<hashB64>
    private static string HashPassword(string password, int iterations = 100_000)
    {
        using var rng = RandomNumberGenerator.Create();
        var salt = new byte[16];
        rng.GetBytes(salt);

        using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
        var hash = pbkdf2.GetBytes(32);

        return $"pbkdf2${iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string raw, string stored)
    {
        // Stöd legacy (plaintext i seed) så inget brakar under uppgradering
        if (!stored.StartsWith("pbkdf2$", StringComparison.Ordinal))
            return raw == stored;

        try
        {
            var parts = stored.Split('$');
            var iterations = int.Parse(parts[1]);
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);

            using var pbkdf2 = new Rfc2898DeriveBytes(raw, salt, iterations, HashAlgorithmName.SHA256);
            var candidate = pbkdf2.GetBytes(expected.Length);
            return CryptographicOperations.FixedTimeEquals(candidate, expected);
        }
        catch
        {
            return false;
        }
    }

    // === Schema & Seed ===
    private static void EnsureSchema()
    {
        using var conn = GetConn();
        conn.Open();

        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS users (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT NOT NULL UNIQUE,
                  password_hash TEXT NOT NULL,
                  role TEXT NOT NULL CHECK(role IN ('admin','user')),
                  created TEXT NOT NULL DEFAULT (datetime('now')),
                  email TEXT,
                  phone TEXT
                );

                CREATE TABLE IF NOT EXISTS posts (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title    TEXT NOT NULL,
                  content  TEXT NOT NULL,
                  author   TEXT NOT NULL,
                  category TEXT NOT NULL,
                  created  TEXT NOT NULL DEFAULT (datetime('now')),
                  updated  TEXT
                );

                CREATE TABLE IF NOT EXISTS comments (
                  id       INTEGER PRIMARY KEY AUTOINCREMENT,
                  post_id  INTEGER NOT NULL,
                  author   TEXT NOT NULL,
                  content  TEXT NOT NULL,
                  created  TEXT NOT NULL DEFAULT (datetime('now')),
                  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_posts_category_created ON posts(category, created DESC);
                CREATE INDEX IF NOT EXISTS idx_posts_title ON posts(title);
                CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, datetime(created) DESC);
                """;
            cmd.ExecuteNonQuery();
        }

        // View: posts + antal kommentarer
        using (var v = conn.CreateCommand())
        {
            v.CommandText = """
                CREATE VIEW IF NOT EXISTS v_posts_with_comment_count AS
                SELECT p.id, p.title, p.author, p.category, p.created, p.updated,
                       COUNT(c.id) AS comment_count
                FROM posts p
                LEFT JOIN comments c ON c.post_id = p.id
                GROUP BY p.id;
                """;
            v.ExecuteNonQuery();
        }

        // Seed användare (hashade lösenord) & välkomstpost
        using (var check = conn.CreateCommand())
        {
            check.CommandText = "SELECT COUNT(*) FROM users";
            var usersCount = Convert.ToInt32(check.ExecuteScalar());
            if (usersCount == 0)
            {
                var adminHash = HashPassword("admin");
                var userHash = HashPassword("user");

                using var seed = conn.CreateCommand();
                seed.CommandText = """
                    INSERT OR IGNORE INTO users (username, password_hash, role)
                    VALUES ($aUser, $aHash, 'admin'),
                           ($uUser, $uHash, 'user');

                    INSERT INTO posts (title, content, author, category)
                    VALUES ('Välkommen', 'Första inlägget – systemet är igång!', 'admin', 'info');
                    """;
                seed.Parameters.AddWithValue("$aUser", "admin");
                seed.Parameters.AddWithValue("$aHash", adminHash);
                seed.Parameters.AddWithValue("$uUser", "user");
                seed.Parameters.AddWithValue("$uHash", userHash);
                seed.ExecuteNonQuery();
            }
        }
    }

    // === Sanering & validering ===
    private static string Sanitize(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        s = Regex.Replace(s, @"<\s*script\b[^>]*>(.*?)<\s*/\s*script\s*>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return s.Trim();
    }
    private static bool IsValidId(string? id) => int.TryParse(id, out var v) && v > 0;
    private static bool IsValidTitle(string? t) => !string.IsNullOrWhiteSpace(t) && t!.Length <= 200;
    private static bool IsValidAuthor(string? a) => !string.IsNullOrWhiteSpace(a) && a!.Length <= 100;
    private static bool IsValidContent(string? c) => !string.IsNullOrWhiteSpace(c) && c!.Length <= 10_000;
    private static bool IsValidCategory(string? c) => !string.IsNullOrWhiteSpace(c) && SafeCategory.IsMatch(c!);
    private static bool IsValidEmail(string? e) => string.IsNullOrWhiteSpace(e) || EmailRegex.IsMatch(e!);
    private static bool IsValidPhone(string? p) => string.IsNullOrWhiteSpace(p) || PhoneRegex.IsMatch(p!);

    // DTOs
    private record PostDto(int id, string title, string content, string author, string category, string created, string? updated);
    private record PostCreateReq(string title, string content, string category); // author sätts server-side
    private record PostUpdateReq(string? title, string? content, string? category); // partiell uppdatering
    private record CommentDto(int id, int post_id, string author, string content, string created);
    private record CommentCreateDto(string author, string content);
    private record ProfileDto(string username, string role, string? email, string? phone);
    private record ProfileUpdate(string? email, string? phone);

    // Hjälp: ägar/roll-koll
    private static async Task<bool> IsOwnerOrAdmin(SqliteConnection conn, string postId, CurrentUser u)
    {
        if (u.IsAdmin) return true;
        using var c = conn.CreateCommand();
        c.CommandText = "SELECT author FROM posts WHERE id=$id";
        c.Parameters.AddWithValue("$id", int.Parse(postId));
        var a = (string?)await c.ExecuteScalarAsync();
        return a != null && a.Equals(u.Username, StringComparison.OrdinalIgnoreCase);
    }

    // ----------------------------------------------------------------
    // Huvud: mappar alla endpoints (utan parameter)
    // ----------------------------------------------------------------
    public static void Start()
    {
        EnsureSchema();

        // HEALTH
        App.MapGet("/api/health", () =>
            Results.Ok(new { ok = true, time = DateTime.UtcNow, db = DbPath, exists = File.Exists(DbPath) }));

        // ============== AUTH ==============
        App.MapPost("/api/auth/register", async (AuthRequest req) =>
        {
            var username = (req.username ?? "").Trim();
            var password = req.password ?? "";

            if (!SafeUsername.IsMatch(username))
                return Results.BadRequest(new { error = "Ogiltigt användarnamn (3–32 tecken, a-z, 0-9, _-.)." });
            if (password.Length < 4 || password.Length > 128)
                return Results.BadRequest(new { error = "Ogiltigt lösenord (4–128 tecken)." });

            using var conn = GetConn();
            await conn.OpenAsync();

            using (var chk = conn.CreateCommand())
            {
                chk.CommandText = "SELECT 1 FROM users WHERE username=$u";
                chk.Parameters.AddWithValue("$u", username);
                var exists = await chk.ExecuteScalarAsync();
                if (exists != null) return Results.Conflict(new { error = "Användarnamnet är upptaget." });
            }

            var hash = HashPassword(password);
            using (var ins = conn.CreateCommand())
            {
                ins.CommandText = "INSERT INTO users (username, password_hash, role) VALUES ($u,$h,'user')";
                ins.Parameters.AddWithValue("$u", username);
                ins.Parameters.AddWithValue("$h", hash);
                await ins.ExecuteNonQueryAsync();
            }

            return Results.Created($"/api/users/{username}", new { username, role = "user" });
        });

        App.MapPost("/api/auth/login", async (HttpContext ctx, AuthRequest req) =>
        {
            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT username, password_hash, role FROM users WHERE username=$u";
            cmd.Parameters.AddWithValue("$u", req.username);
            using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return Results.Unauthorized();

            var username = r.GetString(0);
            var storedHash = r.GetString(1);
            var role = r.GetString(2);
            if (!VerifyPassword(req.password, storedHash)) return Results.Unauthorized();

            var value = Sign($"{username}|{role}");
            ctx.Response.Cookies.Append(
                AUTH_COOKIE,
                value,
                new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Lax,
                    Secure = false,
                    Path = "/"
                });

            return Results.Ok(new { username, role });
        });

        App.MapGet("/api/auth/me", (HttpContext ctx) =>
        {
            return TryGetUser(ctx, out var u)
                ? Results.Ok(new { username = u.Username, role = u.Role })
                : Results.Unauthorized();
        });

        App.MapPost("/api/auth/logout", (HttpContext ctx) =>
        {
            ctx.Response.Cookies.Delete(AUTH_COOKIE, new CookieOptions { Path = "/" });
            return Results.Ok(new { ok = true });
        });

        // ============== PROFILE ==============
        App.MapGet("/api/profile", async (HttpContext ctx) =>
        {
            if (!TryGetUser(ctx, out var u)) return Results.Unauthorized();

            using var conn = GetConn();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT username, role, email, phone FROM users WHERE username=$u";
            cmd.Parameters.AddWithValue("$u", u.Username);
            using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return Results.NotFound();

            var dto = new ProfileDto(
                r.GetString(0),
                r.GetString(1),
                r.IsDBNull(2) ? null : r.GetString(2),
                r.IsDBNull(3) ? null : r.GetString(3)
            );
            return Results.Ok(dto);
        });

        App.MapPut("/api/profile", async (HttpContext ctx, ProfileUpdate incoming) =>
        {
            if (!TryGetUser(ctx, out var u)) return Results.Unauthorized();

            var email = (incoming.email ?? "").Trim();
            var phone = (incoming.phone ?? "").Trim();

            if (!IsValidEmail(email)) return Results.BadRequest(new { error = "Ogiltig e-postadress." });
            if (!IsValidPhone(phone)) return Results.BadRequest(new { error = "Ogiltigt telefonnummer." });

            using var conn = GetConn();
            await conn.OpenAsync();
            using var up = conn.CreateCommand();
            up.CommandText = "UPDATE users SET email=$e, phone=$p WHERE username=$u";
            up.Parameters.AddWithValue("$u", u.Username);
            up.Parameters.AddWithValue("$e", string.IsNullOrWhiteSpace(email) ? DBNull.Value : email);
            up.Parameters.AddWithValue("$p", string.IsNullOrWhiteSpace(phone) ? DBNull.Value : phone);
            var rows = await up.ExecuteNonQueryAsync();
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        });

        // ============== POSTS ==============
        App.MapGet("/api/posts", async (HttpRequest req) =>
        {
            var q = req.Query;
            var rawSearch = (q["search"].ToString() ?? "").Trim();
            var rawCategory = (q["category"].ToString() ?? "").Trim();

            using var conn = GetConn();
            await conn.OpenAsync();

            var sql = """
                SELECT id, title, content, author, category, created, updated
                FROM posts WHERE 1=1
                """;
            var cmd = conn.CreateCommand();
            var clauses = new List<string>();
            if (!string.IsNullOrWhiteSpace(rawSearch))
            {
                clauses.Add("(LOWER(title) LIKE $q OR LOWER(content) LIKE $q OR LOWER(author) LIKE $q)");
                cmd.Parameters.AddWithValue("$q", $"%{rawSearch.ToLower()}%");
            }
            if (!string.IsNullOrWhiteSpace(rawCategory))
            {
                if (!IsValidCategory(rawCategory)) return Results.BadRequest(new { error = "Invalid category" });
                clauses.Add("category = $cat");
                cmd.Parameters.AddWithValue("$cat", rawCategory);
            }
            if (clauses.Count > 0) sql += " AND " + string.Join(" AND ", clauses);
            sql += " ORDER BY datetime(created) DESC";
            cmd.CommandText = sql;

            var list = new List<PostDto>();
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new PostDto(
                    r.GetInt32(0), r.GetString(1), r.GetString(2),
                    r.GetString(3), r.GetString(4), r.GetString(5),
                    r.IsDBNull(6) ? null : r.GetString(6)
                ));
            }
            return Results.Ok(list);
        });

        App.MapGet("/api/posts/{id}", async (string id) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT id, title, content, author, category, created, updated
                FROM posts
                WHERE id = $id
                """;
            cmd.Parameters.AddWithValue("$id", int.Parse(id));

            using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return Results.NotFound();

            var dto = new PostDto(
                r.GetInt32(0), r.GetString(1), r.GetString(2),
                r.GetString(3), r.GetString(4), r.GetString(5),
                r.IsDBNull(6) ? null : r.GetString(6)
            );
            return Results.Ok(dto);
        });

        App.MapPost("/api/posts", async (HttpContext ctx, PostCreateReq incoming) =>
        {
            if (!TryGetUser(ctx, out var u)) return Results.Unauthorized();

            var title = Sanitize(incoming.title);
            var content = Sanitize(incoming.content);
            var category = Sanitize(incoming.category);
            var author = u.Username; // alltid från session

            if (!IsValidTitle(title) || !IsValidContent(content) || !IsValidAuthor(author) || !IsValidCategory(category))
                return Results.BadRequest(new { error = "Invalid input" });

            using var conn = GetConn();
            await conn.OpenAsync();
            using (var insert = conn.CreateCommand())
            {
                insert.CommandText = "INSERT INTO posts (title, content, author, category) VALUES ($t,$c,$a,$cat)";
                insert.Parameters.AddWithValue("$t", title);
                insert.Parameters.AddWithValue("$c", content);
                insert.Parameters.AddWithValue("$a", author);
                insert.Parameters.AddWithValue("$cat", category);
                await insert.ExecuteNonQueryAsync();
            }
            long id;
            using (var last = conn.CreateCommand())
            {
                last.CommandText = "SELECT last_insert_rowid()";
                id = Convert.ToInt64(await last.ExecuteScalarAsync());
            }
            return Results.Created($"/api/posts/{id}", new { id });
        });

        App.MapPut("/api/posts/{id}", async (HttpContext ctx, string id, PostUpdateReq incoming) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });
            if (!TryGetUser(ctx, out var u)) return Results.Unauthorized();

            using var conn = GetConn();
            await conn.OpenAsync();
            if (!await IsOwnerOrAdmin(conn, id, u)) return Results.Forbid();

            var sets = new List<string>();
            var cmd = conn.CreateCommand();
            cmd.Parameters.AddWithValue("$id", int.Parse(id));

            if (incoming.title is not null)
            {
                var title = Sanitize(incoming.title);
                if (!IsValidTitle(title)) return Results.BadRequest(new { error = "Invalid title" });
                sets.Add("title=$t");
                cmd.Parameters.AddWithValue("$t", title);
            }

            if (incoming.content is not null)
            {
                var content = Sanitize(incoming.content);
                if (!IsValidContent(content)) return Results.BadRequest(new { error = "Invalid content" });
                sets.Add("content=$c");
                cmd.Parameters.AddWithValue("$c", content);
            }

            if (incoming.category is not null)
            {
                var category = Sanitize(incoming.category);
                if (!IsValidCategory(category)) return Results.BadRequest(new { error = "Invalid category" });
                sets.Add("category=$cat");
                cmd.Parameters.AddWithValue("$cat", category);
            }

            if (sets.Count == 0)
                return Results.BadRequest(new { error = "No fields to update" });

            cmd.CommandText = $"UPDATE posts SET {string.Join(", ", sets)}, updated=datetime('now') WHERE id=$id";
            var rows = await cmd.ExecuteNonQueryAsync();
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        });

        App.MapDelete("/api/posts/{id}", async (HttpContext ctx, string id) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });
            if (!TryGetUser(ctx, out var u)) return Results.Unauthorized();

            using var conn = GetConn();
            await conn.OpenAsync();
            if (!await IsOwnerOrAdmin(conn, id, u)) return Results.Forbid();

            var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM posts WHERE id=$id";
            cmd.Parameters.AddWithValue("$id", int.Parse(id));
            var rows = await cmd.ExecuteNonQueryAsync();
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        });

        // ============== COMMENTS ==============
        App.MapGet("/api/posts/{postId}/comments", async (string postId) =>
        {
            if (!IsValidId(postId)) return Results.BadRequest(new { error = "Invalid post id" });

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT id, post_id, author, content, created
                FROM comments
                WHERE post_id = $pid
                ORDER BY datetime(created) DESC
                """;
            cmd.Parameters.AddWithValue("$pid", int.Parse(postId));

            var list = new List<CommentDto>();
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new CommentDto(
                    r.GetInt32(0), r.GetInt32(1),
                    r.GetString(2), r.GetString(3), r.GetString(4)
                ));
            }
            return Results.Ok(list);
        });

        App.MapPost("/api/posts/{postId}/comments", async (string postId, CommentCreateDto incoming) =>
        {
            if (!IsValidId(postId)) return Results.BadRequest(new { error = "Invalid post id" });

            var author = Sanitize(incoming.author);
            var content = Sanitize(incoming.content);
            if (string.IsNullOrWhiteSpace(author) || author.Length > 100)
                return Results.BadRequest(new { error = "Invalid author" });
            if (string.IsNullOrWhiteSpace(content) || content.Length > 4000)
                return Results.BadRequest(new { error = "Invalid content" });

            using var conn = GetConn();
            await conn.OpenAsync();

            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT 1 FROM posts WHERE id = $pid";
                check.Parameters.AddWithValue("$pid", int.Parse(postId));
                var exists = await check.ExecuteScalarAsync();
                if (exists is null) return Results.NotFound(new { error = "Post not found" });
            }

            using (var insert = conn.CreateCommand())
            {
                insert.CommandText = """
                    INSERT INTO comments (post_id, author, content, created)
                    VALUES ($pid, $a, $c, datetime('now'))
                    """;
                insert.Parameters.AddWithValue("$pid", int.Parse(postId));
                insert.Parameters.AddWithValue("$a", author);
                insert.Parameters.AddWithValue("$c", content);
                await insert.ExecuteNonQueryAsync();
            }

            long id;
            using (var last = conn.CreateCommand())
            {
                last.CommandText = "SELECT last_insert_rowid()";
                id = Convert.ToInt64(await last.ExecuteScalarAsync());
            }

            return Results.Created($"/api/comments/{id}", new { id });
        });

        App.MapDelete("/api/comments/{id}", async (HttpContext ctx, string id) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });
            if (!TryGetUser(ctx, out var u) || !u.IsAdmin) return Results.Forbid();

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM comments WHERE id = $id";
            cmd.Parameters.AddWithValue("$id", int.Parse(id));
            var rows = await cmd.ExecuteNonQueryAsync();
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        });

        // ============== USERS (lista) ==============
        App.MapGet("/api/users", async () =>
        {
            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id, username, role, created, email, phone FROM users ORDER BY id";
            var list = new List<object>();
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    id = r.GetInt32(0),
                    username = r.GetString(1),
                    role = r.GetString(2),
                    created = r.GetString(3),
                    email = r.IsDBNull(4) ? null : r.GetString(4),
                    phone = r.IsDBNull(5) ? null : r.GetString(5)
                });
            }
            return Results.Ok(list);
        });

        // ============== VIEW endpoint ==============
        App.MapGet("/api/posts/with-count", async () =>
        {
            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id,title,author,category,created,updated,comment_count FROM v_posts_with_comment_count ORDER BY datetime(created) DESC";
            var list = new List<object>();
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    id = r.GetInt32(0),
                    title = r.GetString(1),
                    author = r.GetString(2),
                    category = r.GetString(3),
                    created = r.GetString(4),
                    updated = r.IsDBNull(5) ? null : r.GetString(5),
                    comment_count = r.GetInt32(6)
                });
            }
            return Results.Ok(list);
        });

        // ============== EXPORT (ADMIN-ONLY) ==============
        App.MapGet("/api/export/posts.json", async (HttpContext ctx) =>
        {
            if (!TryGetUser(ctx, out var u) || !u.IsAdmin) return Results.Forbid();

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id,title,content,author,category,created,updated FROM posts ORDER BY id";
            var rows = new List<object>();
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                rows.Add(new
                {
                    id = r.GetInt32(0),
                    title = r.GetString(1),
                    content = r.GetString(2),
                    author = r.GetString(3),
                    category = r.GetString(4),
                    created = r.GetString(5),
                    updated = r.IsDBNull(6) ? null : r.GetString(6)
                });
            }
            var json = System.Text.Json.JsonSerializer.Serialize(rows);
            var bytes = Encoding.UTF8.GetBytes(json);
            return Results.File(bytes, "application/json", "posts.json");
        });

        App.MapGet("/api/export/posts.csv", async (HttpContext ctx) =>
        {
            if (!TryGetUser(ctx, out var u) || !u.IsAdmin) return Results.Forbid();

            static string CsvEscape(string s) => "\"" + s.Replace("\"", "\"\"") + "\"";
            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id,title,content,author,category,created,COALESCE(updated,'') FROM posts ORDER BY id";
            var sb = new StringBuilder();
            sb.AppendLine("id,title,content,author,category,created,updated");
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                sb.Append(r.GetInt32(0)).Append(",");
                sb.Append(CsvEscape(r.GetString(1))).Append(",");
                sb.Append(CsvEscape(r.GetString(2))).Append(",");
                sb.Append(CsvEscape(r.GetString(3))).Append(",");
                sb.Append(CsvEscape(r.GetString(4))).Append(",");
                sb.Append(CsvEscape(r.GetString(5))).Append(",");
                sb.AppendLine(CsvEscape(r.GetString(6)));
            }
            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return Results.File(bytes, "text/csv", "posts.csv");
        });
    }
}
