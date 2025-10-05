namespace WebApp
{
    public static class Server
    {
        public static WebApplication App { get; private set; }

        public static void Start()
        {
            var builder = WebApplication.CreateBuilder();

            // Lyssna på alla interfaces i containern: 0.0.0.0:{port}
            var portStr = (string)Globals.port;
            if (!int.TryParse(portStr, out var port)) port = 8080;

            // Antingen UseUrls...
            builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
            // ...eller Kestrel-API:t (valfritt):
            // builder.WebHost.ConfigureKestrel(o => o.ListenAnyIP(port));

            App = builder.Build();

            Middleware();
            DebugLog.Start();
            Acl.Start();
            ErrorHandler.Start();
            FileServer.Start();
            LoginRoutes.Start();
            RestApi.Start();
            Session.Start();

            Log("Server running on:", $"http://0.0.0.0:{port}");
            Log("With these settings:", Globals);

            // Kör utan URL här – vi har redan satt UseUrls ovan
            App.Run();
        }

        // Middleware som tidigare
        public static void Middleware()
        {
            App.Use(async (context, next) =>
            {
                context.Response.Headers.Append("Server", (string)Globals.serverName);
                DebugLog.Register(context);
                Session.Touch(context);

                if (!Acl.Allow(context))
                {
                    context.Response.StatusCode = 405;
                    var error = new { error = "Not allowed." };
                    DebugLog.Add(context, error);
                    await context.Response.WriteAsJsonAsync(error);
                }
                else
                {
                    await next(context);
                }

                var res = context.Response;
                var contentLength = res.ContentLength ?? 0;
                var info = Obj(new
                {
                    statusCode = res.StatusCode,
                    contentType = res.ContentType,
                    contentLengthKB = Math.Round(contentLength / 10.24) / 100,
                    RESPONSE_DONE = Now
                });
                if (info.contentLengthKB == null || info.contentLengthKB == 0) info.Delete("contentLengthKB");
                DebugLog.Add(context, info);
            });
        }
    }
}
