#nullable enable
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;

namespace WebApp;

public static class RestApi
{
    private static readonly Regex SafeCategory = new(@"^[a-zA-Z0-9\s\-_]{1,64}$", RegexOptions.Compiled);

    // === Databasplacering: backend/data/_db.sqlite3 ===
    private static string DbDir
        => Path.Combine(App.Environment.ContentRootPath, "data");   // <projekt>/backend/data
    private static string DbPath
        => Path.Combine(DbDir, "_db.sqlite3");

    private static void EnsureDbDirectory()
    {
        if (!Directory.Exists(DbDir))
            Directory.CreateDirectory(DbDir);
    }

    private static SqliteConnection GetConn()
    {
        EnsureDbDirectory();
        var cs = new SqliteConnectionStringBuilder
        {
            DataSource = DbPath,
            Mode = SqliteOpenMode.ReadWriteCreate // skapar fil om saknas
        }.ToString();
        return new SqliteConnection(cs);
    }

    // === Auto-skapar schema och minimal seed om saknas ===
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
                  created TEXT NOT NULL DEFAULT (datetime('now'))
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

                CREATE INDEX IF NOT EXISTS idx_posts_category_created
                  ON posts(category, created DESC);
                CREATE INDEX IF NOT EXISTS idx_posts_title ON posts(title);
                CREATE INDEX IF NOT EXISTS idx_comments_post_created
                  ON comments(post_id, datetime(created) DESC);
                """;
            cmd.ExecuteNonQuery();
        }

        // Minimal seed om tomt
        using (var check = conn.CreateCommand())
        {
            check.CommandText = "SELECT COUNT(*) FROM users";
            var usersCount = Convert.ToInt32(check.ExecuteScalar());
            if (usersCount == 0)
            {
                using var seed = conn.CreateCommand();
                seed.CommandText = """
                    INSERT OR IGNORE INTO users (username, password_hash, role)
                    VALUES ('admin', 'admin', 'admin');

                    INSERT INTO posts (title, content, author, category)
                    VALUES ('Välkommen', 'Första inlägget – systemet är igång!', 'admin', 'info');
                    """;
                seed.ExecuteNonQuery();
            }
        }
    }

    // --- Sanering & validering ---
    private static string Sanitize(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        // ta bort <script>...</script>
        s = Regex.Replace(s, @"<\s*script\b[^>]*>(.*?)<\s*/\s*script\s*>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return s.Trim();
    }
    private static bool IsValidId(string? id) => int.TryParse(id, out var v) && v > 0;
    private static bool IsValidTitle(string? t) => !string.IsNullOrWhiteSpace(t) && t!.Length <= 200;
    private static bool IsValidAuthor(string? a) => !string.IsNullOrWhiteSpace(a) && a!.Length <= 100;
    private static bool IsValidContent(string? c) => !string.IsNullOrWhiteSpace(c) && c!.Length <= 10_000;
    private static bool IsValidCategory(string? c) => !string.IsNullOrWhiteSpace(c) && SafeCategory.IsMatch(c!);

    // DTOs
    private record PostDto(int id, string title, string content, string author, string category, string created, string? updated);
    private record PostCreateDto(string title, string content, string author, string category);

    private record CommentDto(int id, int post_id, string author, string content, string created);
    private record CommentCreateDto(string author, string content);

    public static void Start()
    {
        // Skapa mapp, fil och schema om det saknas
        EnsureSchema();

        // HEALTH
        App.MapGet("/api/health", () =>
            Results.Ok(new { ok = true, time = DateTime.UtcNow, db = DbPath, exists = File.Exists(DbPath) }));

        // DEBUG
        App.MapGet("/api/debug/db", async () =>
        {
            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
            var tables = new List<string>();
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync()) tables.Add(r.GetString(0));
            return Results.Ok(new { path = DbPath, exists = File.Exists(DbPath), tables });
        });

        // Preflight (OPTIONS)
        App.MapMethods("/api/{**path}", new[] { "OPTIONS" }, (HttpContext ctx) =>
        {
            var origin = ctx.Request.Headers.Origin.ToString();
            var allowOrigin = string.IsNullOrEmpty(origin) ? "http://localhost:5173" : origin;
            ctx.Response.Headers["Access-Control-Allow-Origin"] = allowOrigin;
            ctx.Response.Headers["Vary"] = "Origin";
            ctx.Response.Headers["Access-Control-Allow-Credentials"] = "true";
            ctx.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
            ctx.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";
            return Results.Ok();
        });

        // ===================== POSTS =====================

        // LISTA
        App.MapGet("/api/posts", async (HttpRequest req) =>
        {
            var q = req.Query;
            var rawSearch = (q["search"].ToString() ?? string.Empty).Trim();
            var rawCategory = (q["category"].ToString() ?? string.Empty).Trim();

            using var conn = GetConn();
            await conn.OpenAsync();

            var sql = """
                SELECT id, title, content, author, category, created, updated
                FROM posts
                WHERE 1=1
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

        // GET BY ID
        App.MapGet("/api/posts/{id}", async (string id) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT id, title, content, author, category, created, updated
                FROM posts
                WHERE id=$id
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

        // CREATE (separerar INSERT + last_insert_rowid för stabilitet)
        App.MapPost("/api/posts", async (PostCreateDto incoming) =>
        {
            var title = Sanitize(incoming.title);
            var content = Sanitize(incoming.content);
            var author = Sanitize(incoming.author);
            var category = Sanitize(incoming.category);

            if (!IsValidTitle(title) || !IsValidContent(content) || !IsValidAuthor(author) || !IsValidCategory(category))
                return Results.BadRequest(new { error = "Invalid input" });

            using var conn = GetConn();
            await conn.OpenAsync();

            using (var insert = conn.CreateCommand())
            {
                insert.CommandText = """
                    INSERT INTO posts (title, content, author, category)
                    VALUES ($t, $c, $a, $cat)
                    """;
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

        // UPDATE
        App.MapPut("/api/posts/{id}", async (string id, PostCreateDto incoming) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });

            var title = Sanitize(incoming.title);
            var content = Sanitize(incoming.content);
            var author = Sanitize(incoming.author);
            var category = Sanitize(incoming.category);

            if (!IsValidTitle(title) || !IsValidContent(content) || !IsValidAuthor(author) || !IsValidCategory(category))
                return Results.BadRequest(new { error = "Invalid input" });

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = """
                UPDATE posts
                SET title=$t, content=$c, author=$a, category=$cat, updated=datetime('now')
                WHERE id=$id;
                """;
            cmd.Parameters.AddWithValue("$t", title);
            cmd.Parameters.AddWithValue("$c", content);
            cmd.Parameters.AddWithValue("$a", author);
            cmd.Parameters.AddWithValue("$cat", category);
            cmd.Parameters.AddWithValue("$id", int.Parse(id));

            var rows = await cmd.ExecuteNonQueryAsync();
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        });

        // DELETE
        App.MapDelete("/api/posts/{id}", async (string id) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM posts WHERE id=$id";
            cmd.Parameters.AddWithValue("$id", int.Parse(id));

            var rows = await cmd.ExecuteNonQueryAsync();
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        });

        // ===================== COMMENTS =====================

        // GET /api/posts/{postId}/comments
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

        // POST /api/posts/{postId}/comments
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

            // Validera att posten finns
            using (var check = conn.CreateCommand())
            {
                check.CommandText = "SELECT 1 FROM posts WHERE id = $pid";
                check.Parameters.AddWithValue("$pid", int.Parse(postId));
                var exists = await check.ExecuteScalarAsync();
                if (exists is null) return Results.NotFound(new { error = "Post not found" });
            }

            // Insert
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

            // Hämta id
            long id;
            using (var last = conn.CreateCommand())
            {
                last.CommandText = "SELECT last_insert_rowid()";
                id = Convert.ToInt64(await last.ExecuteScalarAsync());
            }

            return Results.Created($"/api/comments/{id}", new { id });
        });

        // DELETE /api/comments/{id}
        App.MapDelete("/api/comments/{id}", async (string id) =>
        {
            if (!IsValidId(id)) return Results.BadRequest(new { error = "Invalid id" });

            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM comments WHERE id = $id";
            cmd.Parameters.AddWithValue("$id", int.Parse(id));

            var rows = await cmd.ExecuteNonQueryAsync();
            return rows == 0 ? Results.NotFound() : Results.NoContent();
        });

        // ===================== USERS (enkel lista, inga lösenord) =====================

        App.MapGet("/api/users", async () =>
        {
            using var conn = GetConn();
            await conn.OpenAsync();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id, username, role, created FROM users ORDER BY id";

            var list = new List<object>();
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    id = r.GetInt32(0),
                    username = r.GetString(1),
                    role = r.GetString(2),
                    created = r.GetString(3)
                });
            }
            return Results.Ok(list);
        });
    }
}
