using System;
using System.IO;

// 1) Läs portar/banor från ENV först, annars från args, annars defaults
string port = Environment.GetEnvironmentVariable("PORT")
           ?? (args.Length > 0 ? args[0] : "5000");

string frontendPathRaw = Environment.GetEnvironmentVariable("FRONTEND_PATH")
                      ?? (args.Length > 1 ? args[1] : "../public");

string dbPathRaw = Environment.GetEnvironmentVariable("DB_PATH")
                 ?? (args.Length > 2 ? args[2] : "_db.sqlite3");

// 2) Normalisera ev. relativa sökvägar till absoluta (bra i container)
string baseDir = AppContext.BaseDirectory;
string frontendPath = Path.IsPathRooted(frontendPathRaw)
    ? frontendPathRaw
    : Path.GetFullPath(Path.Combine(baseDir, frontendPathRaw));

string dbPath = Path.IsPathRooted(dbPathRaw)
    ? dbPathRaw
    : Path.GetFullPath(Path.Combine(baseDir, dbPathRaw));

// 3) ACL från ENV (utan Json-parser).
//    Viktigt är bara att "acl" finns och har en "rules"-array (kan vara tom).
bool aclOnEnv = (Environment.GetEnvironmentVariable("ACL_ON") ?? "false")
    .Trim().ToLowerInvariant() == "true";

// Om du senare vill stödja ACL_RULES som JSON kan du lägga till en riktig parser.
// För nu: håll det enkelt = tom array.
dynamic aclRulesDyn = Arr();

// 4) Globals – se till att 'acl' alltid har 'on' + 'rules'
Globals = Obj(new
{
    debugOn = true,
    detailedAclDebug = false,
    isSpa = true,
    port,
    serverName = "Minimal API Backend",
    frontendPath,
    dbPath,
    sessionLifeTimeHours = 2,

    acl = Obj(new
    {
        on = aclOnEnv,
        rules = aclRulesDyn
    })
});

// 5) Starta
Server.Start();
