// backend/src/LoginRoutes.cs
#nullable enable

namespace WebApp;

public static class LoginRoutes
{
    public static void Start()
    {

        App.MapGet("/api/session", (HttpContext ctx) =>
        {
            var user = Session.Get(ctx, "user");
            return RestResult.Parse(ctx, user ?? new { error = "No user is logged in." });
        });
    }
}
