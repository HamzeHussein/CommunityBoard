# --- Build stage ---
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Kopiera csproj separat för snabbare cache
COPY backend/*.csproj ./backend/
RUN dotnet restore ./backend/Backend.csproj

# Kopiera resten och publicera
COPY backend/ ./backend/
WORKDIR /src/backend
RUN dotnet publish -c Release -o /app/publish

# --- Runtime stage ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Render skickar PORT — låt Kestrel lyssna på den
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}

COPY --from=build /app/publish ./

# (valfritt för lokal test)
EXPOSE 8080

CMD ["dotnet", "Backend.dll"]
