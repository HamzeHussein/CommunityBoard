using System.IO;
using Microsoft.Extensions.FileProviders;

namespace WebApp;

public static class FileServer
{
    private static string FPath = "";

    public static void Start()
    {
        // Ska vi ens serva SPA?
        var isSpa = (Globals?.isSpa as bool?) ?? false;
        var configuredPath = (string)(Globals?.frontendPath ?? "");

        if (!isSpa)
        {
            Console.WriteLine("🟡 FileServer: isSpa=false → kör API-läge utan SPA.");
            return;
        }

        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            Console.WriteLine("🟡 FileServer: frontendPath saknas → hoppar över SPA.");
            return;
        }

        // Gör absolut path
        var absolute = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), configuredPath));

        if (!Directory.Exists(absolute))
        {
            Console.WriteLine($"🟡 FileServer: Hittar inte mappen '{absolute}' → hoppar över SPA.");
            return;
        }

        FPath = absolute;

        HandleStatusCodes();
        ServeFiles();
        ServeFileLists();
    }

    // Skriv statuskoder som body; servera index.html för SPA endast om allt finns
    private static void HandleStatusCodes()
    {
        App.UseStatusCodePages(async statusCodeContext =>
        {
            var context = statusCodeContext.HttpContext;
            var request = context.Request;
            var response = context.Response;
            var statusCode = response.StatusCode;
            var isInApi = request.Path.StartsWithSegments("/api");
            var isFilePath = (request.Path + "").Contains('.');

            var type = isInApi || statusCode != 404
                ? "application/json; charset=utf-8"
                : "text/html";

            response.ContentType = type;

            var isSpa = (Globals?.isSpa as bool?) ?? false;
            var canServeIndex =
                isSpa &&
                !isInApi &&
                !isFilePath &&
                statusCode == 404 &&
                !string.IsNullOrEmpty(FPath) &&
                File.Exists(Path.Combine(FPath, "index.html"));

            if (canServeIndex)
            {
                // Låt SPA:n ta över routingen
                response.StatusCode = 200;
                await response.WriteAsync(
                    File.ReadAllText(Path.Combine(FPath, "index.html"))
                );
            }
            else
            {
                var error = statusCode == 404 ? "404. Not found." : "Status code: " + statusCode;
                await response.WriteAsJsonAsync(new { error });
            }
        });
    }

    private static void ServeFiles()
    {
        if (string.IsNullOrEmpty(FPath) || !Directory.Exists(FPath))
        {
            Console.WriteLine("🟡 FileServer: Ingen giltig FPath → hoppar över UseFileServer.");
            return;
        }

        App.UseFileServer(new FileServerOptions
        {
            FileProvider = new PhysicalFileProvider(FPath),
            EnableDefaultFiles = true,
            EnableDirectoryBrowsing = false
        });
    }

    private static void ServeFileLists()
    {
        if (string.IsNullOrEmpty(FPath) || !Directory.Exists(FPath))
        {
            // Ingen frontend → ingen fil-lista
            return;
        }

        App.MapGet("/api/files/{folder}", (HttpContext context, string folder) =>
        {
            object result = null;
            try
            {
                result = Arr(Directory.GetFiles(Path.Combine(FPath, folder)))
                    .Map(x => Arr(x.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)).Pop())
                    .Filter(x => Acl.Allow(context, "GET", "/content/" + x));
            }
            catch { /* ignore */ }

            return RestResult.Parse(context, result);
        });
    }
}
