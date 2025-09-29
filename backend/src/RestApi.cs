using System.Text.Json;

namespace WebApp;

public static class RestApi
{
    public static void Start()
    {
        // --- HEALTH (måste finnas, ligger före generiska /api/{table}) ---
        App.MapGet("/api/health", () => Results.Ok(new { ok = true, time = DateTime.UtcNow }));

        // --- Preflight (OPTIONS) – returnera Task/IResult för att undvika typkrock ---
        App.MapMethods("/api/{**path}", new[] { "OPTIONS" }, (HttpContext ctx) =>
        {
            ctx.Response.Headers["Access-Control-Allow-Origin"] = "*";
            ctx.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
            ctx.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS";
            // Viktigt: returnera Task/IResult, inte bara IResult
            return Task.FromResult(Results.Ok());
        });

        // --- Specifik GET /api/posts med sök/filtrering ---
        App.MapGet("/api/posts", (HttpContext context) =>
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
        });

        // --- Specifik PUT /api/posts/{id} ---
        App.MapPut("/api/posts/{id}", (HttpContext context, string id, JsonElement bodyJson) =>
        {
            var body = JSON.Parse(bodyJson.ToString());
            body.id = id; // viktigt för WHERE id = $id

            // Bygger SET-lista + parametrar för tillåtna fält
            var parsed = ReqBodyParse("posts", body);
            var update = parsed.update; // t.ex. "title=$title, content=$content, updatedAt=$updatedAt"
            var sql = $"UPDATE posts SET {update} WHERE id = $id";
            var result = SQLQueryOne(sql, parsed.body, context);
            return RestResult.Parse(context, result);
        });

        // ============================================================
        // GENERISKA REST-ENDPOINTS (lägg ALLTID efter specifika)
        // ============================================================

        App.MapPost("/api/{table}", (HttpContext context, string table, JsonElement bodyJson) =>
        {
            var body = JSON.Parse(bodyJson.ToString());
            body.Delete("id");
            var parsed = ReqBodyParse(table, body);
            var columns = parsed.insertColumns;
            var values = parsed.insertValues;
            var sql = $"INSERT INTO {table}({columns}) VALUES({values})";
            var result = SQLQueryOne(sql, parsed.body, context);
            if (!result.HasKey("error"))
            {
                result.insertId = SQLQueryOne(@$"SELECT id AS __insertId FROM {table} ORDER BY id DESC LIMIT 1").__insertId;
            }
            return RestResult.Parse(context, result);
        });

        App.MapGet("/api/{table}", (HttpContext context, string table) =>
        {
            var sql = $"SELECT * FROM {table}";
            var query = RestQuery.Parse(context.Request.Query);
            sql += query.sql;
            return RestResult.Parse(context, SQLQuery(sql, query.parameters, context));
        });

        App.MapGet("/api/{table}/{id}", (HttpContext context, string table, string id) =>
            RestResult.Parse(context, SQLQueryOne(
                $"SELECT * FROM {table} WHERE id = $id",
                ReqBodyParse(table, Obj(new { id })).body,
                context
            ))
        );

        App.MapPut("/api/{table}/{id}", (HttpContext context, string table, string id, JsonElement bodyJson) =>
        {
            var body = JSON.Parse(bodyJson.ToString());
            body.id = id;
            var parsed = ReqBodyParse(table, body);
            var update = parsed.update;
            var sql = $"UPDATE {table} SET {update} WHERE id = $id";
            var result = SQLQueryOne(sql, parsed.body, context);
            return RestResult.Parse(context, result);
        });

        App.MapDelete("/api/{table}/{id}", (HttpContext context, string table, string id) =>
            RestResult.Parse(context, SQLQueryOne(
                $"DELETE FROM {table} WHERE id = $id",
                ReqBodyParse(table, Obj(new { id })).body,
                context
            ))
        );
    }
}

