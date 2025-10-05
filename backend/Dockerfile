# --- build stage ---
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/*.csproj ./backend/
RUN dotnet restore ./backend/Backend.csproj

COPY backend/ ./backend/
WORKDIR /src/backend
RUN dotnet publish -c Release -o /app/publish

# --- runtime stage ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish ./

# Din app skriver/läser SQLite i /app/data
VOLUME ["/app/data"]

# Lyssna på 8080 utåt
EXPOSE 8080

# Kör .NET-appen och låt eventuella argument (t.ex. 8080) skickas till programmet
ENTRYPOINT ["dotnet","Backend.dll"]

# (Valfritt) standardargument = 8080 så att den funkar även utan extra arg till `docker run`
CMD ["8080"]
