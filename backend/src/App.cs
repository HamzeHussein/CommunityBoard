using System;
using System.IO;

// 1) Läs port, frontendPath och dbPath från ENV först, annars från args, annars vettiga default
var envPort = Environment.GetEnvironmentVariable("APP_PORT");
var envFrontend = Environment.GetEnvironmentVariable("FRONTEND_PATH");
var envDb = Environment.GetEnvironmentVariable("DB_PATH");

var port = !string.IsNullOrWhiteSpace(envPort) ? envPort : (args.Length > 0 ? args[0] : "5000");
// Lärarens default pekar på "dist" i projektroten; vi överskriver i produktion via env FRONTEND_PATH
var frontendPath = !string.IsNullOrWhiteSpace(envFrontend) ? envFrontend : (args.Length > 1 ? args[1] : "../../dist");
// Lärarens default: DB ligger i backend-mappen; i produktion sätter vi env DB_PATH till /home/site/data/_db.sqlite3 (Azure)
var dbPath = !string.IsNullOrWhiteSpace(envDb) ? envDb : (args.Length > 2 ? args[2] : "../_db.sqlite3");

// 2) Se till att DB-katalogen finns och kopiera in seed-DB om filen saknas
try
{
    var dbDir = Path.GetDirectoryName(dbPath);
    if (!string.IsNullOrEmpty(dbDir))
        Directory.CreateDirectory(dbDir);

    if (!File.Exists(dbPath))
    {
        // Kandidater där seed kan ligga efter build/publish
        var baseDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, "db_template", "_db.sqlite3"), // om db_template packas med
            Path.Combine(baseDir, "_db.sqlite3"),                 // om _db.sqlite3 ligger bredvid DLL
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "db_template", "_db.sqlite3")), // dev-körning
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "_db.sqlite3"))
        };

        foreach (var seed in candidates)
        {
            if (File.Exists(seed))
            {
                File.Copy(seed, dbPath, overwrite: false);
                break;
            }
        }
    }
}
catch { /* tyst – om vi inte kan kopiera seed kör vi ändå, så länge DB_path ev. pekar på en skrivbar plats */ }

// 3) Globala settings för din app
Globals = Obj(new
{
    debugOn = false,            // viktigt i produktion
    detailedAclDebug = false,
    aclOn = false,
    isSpa = true,
    port,
    serverName = "Minimal API Backend",
    frontendPath,
    dbPath,
    sessionLifeTimeHours = 2
});

// 4) Starta servern
Server.Start();
