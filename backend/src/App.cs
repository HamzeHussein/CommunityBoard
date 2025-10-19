using System;
using System.IO;

// --- Läs port, frontendPath och dbPath ---
var envPort = Environment.GetEnvironmentVariable("PORT")
             ?? Environment.GetEnvironmentVariable("APP_PORT");
var port = !string.IsNullOrWhiteSpace(envPort) ? envPort : (args.Length > 0 ? args[0] : "5000");

// FRONTEND_PATH används bara i prod när vi faktiskt har en dist-mapp.
// Lokalt kör vi Vite dev-server, så vi stänger av den här.
var envFrontend = Environment.GetEnvironmentVariable("FRONTEND_PATH");
var frontendPath = ""; // <-- API-läge lokalt. Ingen SPA från backend.

// DB_PATH
var envDb = Environment.GetEnvironmentVariable("DB_PATH");
var dbPath = !string.IsNullOrWhiteSpace(envDb)
    ? envDb
    : (args.Length > 2 ? args[2] : "../_db.sqlite3");

// --- Skapa katalog och kopiera seed-db om saknas ---
try
{
    var dbDir = Path.GetDirectoryName(dbPath);
    if (!string.IsNullOrEmpty(dbDir))
        Directory.CreateDirectory(dbDir);

    if (!File.Exists(dbPath))
    {
        var baseDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, "db_template", "_db.sqlite3"),
            Path.Combine(baseDir, "_db.sqlite3"),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "db_template", "_db.sqlite3")),
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
catch { /* ignore */ }

// --- Globala settings till din app ---
Globals = Obj(new
{
    debugOn = false,
    detailedAclDebug = false,
    aclOn = false,
    acl = Array.Empty<object>(),   // förhindra null i ACL
    isSpa = false,                 // <-- Viktigt: API-läge lokalt
    port,
    serverName = "Minimal API Backend",
    frontendPath,                  // tomt lokalt
    dbPath,
    sessionLifeTimeHours = 2
});

// Starta servern
Server.Start();
