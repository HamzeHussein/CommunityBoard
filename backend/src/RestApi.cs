using System.Text.Json;
using System.Text.RegularExpressions;
using System.Linq;
using System.Dynamic;
using System.Collections.Generic;

namespace WebApp;

public static class RestApi
{
    private static readonly string[] _allowedTables = { "posts", "users", "categories" };
    private static readonly string[] _allowedPostFields = { "title", "content", "category", "author", "updatedAt" };

    public static void Start()
    {
        // --- HEALTH (snabb koll att backend lever) ---
        App.MapGet("/api/health", () => Results.Ok(new { ok = true, time = DateTime.UtcNow }));

        // --- Preflight (OPTIONS) – stöd för credentials ---
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

        // --- SPECIFIK GET /api/posts med sök/filtrering ---
        App.MapGet("/api/posts", (HttpContext context) =>
        {
            try
            {
                var q = context.Request.Query;
                var rawSearch = (q["search"].ToString() ?? string.Empty).Trim();
                var rawCategory = (q["category"].ToString() ?? string.Empty).Trim();

                var where = "WHERE 1=1";
                dynamic parameters = Obj(new { });

                if (!string.IsNullOrEmpty(rawSearch))
                {
                    var s = $"%{rawSearch.ToLower()}%";
                    parameters.search = s;
                    where += @"
                        AND (
                            LOWER(title)   LIKE $search OR
                            LOWER(content) LIKE $search OR
                            LOWER(author)  LIKE $search
                        )";
                }

                if (!string.IsNullOrEmpty(rawCategory))
                {
                    if (!IsValidCategory(rawCategory))
                    {
                        return Results.BadRequest("Invalid category");
                    }
                    parameters.category = rawCategory;
                    where += " AND category = $category";
                }

                var sql = $@"
                    SELECT *
                    FROM posts
                    {where}
                    ORDER BY createdAt DESC";

                var result = SQLQuery(sql, parameters, context);
                return RestResult.Parse(context, result);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error retrieving posts: {ex.Message}");
            }
        });

        // --- SPECIFIK PUT /api/posts/{id} ---
        App.MapPut("/api/posts/{id}", (HttpContext context, string id, JsonElement bodyJson) =>
        {
            try
            {
                if (!IsValidId(id)) return Results.BadRequest("Invalid ID format");

                var body = JSON.Parse(bodyJson.ToString());
                var validationResult = ValidatePostData(body);
                if (validationResult != null) return validationResult;

                body.id = id;
                body.updatedAt = DateTime.UtcNow.ToString("o");

                var parsed = ReqBodyParse("posts", body, _allowedPostFields);
                var update = parsed.update;

                var sql = $"UPDATE posts SET {update} WHERE id = $id";
                var result = SQLQueryOne(sql, parsed.body, context);

                return RestResult.Parse(context, result);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error updating post: {ex.Message}");
            }
        });

        // ===================== GENERISKA REST-rutter =====================

        App.MapPost("/api/{table}", (HttpContext context, string table, JsonElement bodyJson) =>
        {
            try
            {
                if (!IsValidTableName(table)) return Results.BadRequest("Invalid table name");

                var body = JSON.Parse(bodyJson.ToString());
                body.Delete("id");

                if (table == "posts")
                {
                    var validationResult = ValidatePostData(body);
                    if (validationResult != null) return validationResult;
                    body.createdAt = DateTime.UtcNow.ToString("o");
                }

                var parsed = ReqBodyParse(table, body);
                var sql = $"INSERT INTO {table}({parsed.insertColumns}) VALUES({parsed.insertValues})";
                var result = SQLQueryOne(sql, parsed.body, context);

                if (!result.HasKey("error"))
                {
                    result.insertId = SQLQueryOne(@$"
                        SELECT id AS __insertId
                        FROM {table}
                        ORDER BY id DESC
                        LIMIT 1
                    ").__insertId;
                }

                return RestResult.Parse(context, result);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error creating record: {ex.Message}");
            }
        });

        App.MapGet("/api/{table}", (HttpContext context, string table) =>
        {
            try
            {
                if (!IsValidTableName(table)) return Results.BadRequest("Invalid table name");

                var sql = $"SELECT * FROM {table}";
                var query = ParseQueryParameters(context.Request.Query); // Ändrat namn här
                sql += query.sql;

                return RestResult.Parse(context, SQLQuery(sql, query.parameters, context));
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error retrieving data: {ex.Message}");
            }
        });

        App.MapGet("/api/{table}/{id}", (HttpContext context, string table, string id) =>
        {
            try
            {
                if (!IsValidTableName(table)) return Results.BadRequest("Invalid table name");
                if (!IsValidId(id)) return Results.BadRequest("Invalid ID format");

                return RestResult.Parse(context, SQLQueryOne(
                    $"SELECT * FROM {table} WHERE id = $id",
                    ReqBodyParse(table, Obj(new { id })).body,
                    context
                ));
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error retrieving record: {ex.Message}");
            }
        });

        App.MapPut("/api/{table}/{id}", (HttpContext context, string table, string id, JsonElement bodyJson) =>
        {
            try
            {
                if (!IsValidTableName(table)) return Results.BadRequest("Invalid table name");
                if (!IsValidId(id)) return Results.BadRequest("Invalid ID format");

                var body = JSON.Parse(bodyJson.ToString());

                if (table == "posts")
                {
                    var validationResult = ValidatePostData(body);
                    if (validationResult != null) return validationResult;
                    body.updatedAt = DateTime.UtcNow.ToString("o");
                }

                body.id = id;
                var parsed = ReqBodyParse(table, body);
                var update = parsed.update;

                var sql = $"UPDATE {table} SET {update} WHERE id = $id";
                var result = SQLQueryOne(sql, parsed.body, context);

                return RestResult.Parse(context, result);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error updating record: {ex.Message}");
            }
        });

        App.MapDelete("/api/{table}/{id}", (HttpContext context, string table, string id) =>
        {
            try
            {
                if (!IsValidTableName(table)) return Results.BadRequest("Invalid table name");
                if (!IsValidId(id)) return Results.BadRequest("Invalid ID format");

                return RestResult.Parse(context, SQLQueryOne(
                    $"DELETE FROM {table} WHERE id = $id",
                    ReqBodyParse(table, Obj(new { id })).body,
                    context
                ));
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error deleting record: {ex.Message}");
            }
        });
    }

    // ===================== HJÄLPMETODER =====================

    private static bool IsValidTableName(string table)
    {
        var tableLower = table?.ToLower() ?? "";
        return _allowedTables.Any(allowedTable => allowedTable == tableLower);
    }

    private static bool IsValidId(string id) =>
        !string.IsNullOrWhiteSpace(id) && Regex.IsMatch(id, @"^\d+$");

    private static bool IsValidCategory(string category)
    {
        return !string.IsNullOrWhiteSpace(category) &&
               category.Length <= 50 &&
               Regex.IsMatch(category, @"^[a-zA-Z0-9\s\-_]+$");
    }

    private static IResult ValidatePostData(dynamic body)
    {
        if (body == null) return Results.BadRequest("Request body is required");

        var title = body.title?.ToString() ?? "";
        var content = body.content?.ToString() ?? "";

        if (string.IsNullOrWhiteSpace(title)) return Results.BadRequest("Title is required");
        if (string.IsNullOrWhiteSpace(content)) return Results.BadRequest("Content is required");
        if (title.Length > 200) return Results.BadRequest("Title too long");
        if (content.Length > 4000) return Results.BadRequest("Content too long");

        return null;
    }

    private static dynamic ReqBodyParse(string table, dynamic body, string[] allowedFields = null)
    {
        var bodyDict = new Dictionary<string, object>();
        var setParts = new List<string>();
        var columns = new List<string>();
        var values = new List<string>();

        foreach (var prop in body.GetProperties())
        {
            var key = prop.Key;
            var value = prop.Value;

            if (allowedFields != null)
            {
                var allowedFieldsList = allowedFields.ToList();
                if (!allowedFieldsList.Contains(key))
                    continue;
            }

            if (value is string strVal)
                value = EscapeHtml(strVal);

            bodyDict[key] = value;

            if (key != "id")
            {
                setParts.Add($"{key} = ${key}");
                columns.Add(key);
                values.Add($"${key}");
            }
        }

        return new
        {
            update = string.Join(", ", setParts),
            insertColumns = string.Join(", ", columns),
            insertValues = string.Join(", ", values),
            body = Obj(bodyDict)
        };
    }

    private static string EscapeHtml(string input) =>
        string.IsNullOrEmpty(input) ? input :
        input.Replace("&", "&amp;")
             .Replace("<", "&lt;")
             .Replace(">", "&gt;")
             .Replace("\"", "&quot;")
             .Replace("'", "&#x27;");

    // NY METOD - ersätter RestQuery.Parse för att fixa dubbleringsfelet
    private static dynamic ParseQueryParameters(IQueryCollection query)
    {
        var where = new List<string>();
        dynamic parameters = new ExpandoObject();
        var paramDict = (IDictionary<string, object>)parameters;

        foreach (var (key, value) in query)
        {
            if (key.StartsWith("_") || string.IsNullOrEmpty(value.ToString())) continue;
            var paramKey = key.Replace(".", "_");
            where.Add($"{key} = ${paramKey}");
            paramDict[paramKey] = value.ToString();
        }

        var sql = where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "";
        return new { sql, parameters };
    }
}