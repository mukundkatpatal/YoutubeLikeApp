using System;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using YoutubeBeta.Models;

namespace YoutubeBeta.Services;

public sealed class UpdateService
{
    private readonly HttpClient _httpClient;
    private readonly string _manifestUrl;

    public UpdateService(HttpClient httpClient, string manifestUrl)
    {
        _httpClient = httpClient;
        _manifestUrl = manifestUrl;
    }

    public string CurrentVersion { get; } = ResolveCurrentVersion();

    public async Task<UpdateCheckResult> CheckAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var response = await _httpClient.GetAsync(_manifestUrl, cancellationToken)
                .ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken)
                .ConfigureAwait(false);
            var manifest = await JsonSerializer.DeserializeAsync<UpdateManifest>(
                stream,
                JsonDefaults.Options,
                cancellationToken).ConfigureAwait(false);

            if (manifest is null || string.IsNullOrWhiteSpace(manifest.Version))
            {
                return UpdateCheckResult.Failed(CurrentVersion, "Update manifest is empty or invalid.");
            }

            if (!IsRemoteNewer(manifest.Version, CurrentVersion))
            {
                return UpdateCheckResult.Current(CurrentVersion, $"App is current at version {CurrentVersion}.");
            }

            return new UpdateCheckResult(
                true,
                manifest.Required,
                CurrentVersion,
                manifest.Version,
                manifest.DownloadUrl,
                manifest.Notes,
                manifest.Required
                    ? $"Required update {manifest.Version} is available."
                    : $"Update {manifest.Version} is available.");
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or JsonException or TaskCanceledException)
        {
            return UpdateCheckResult.Failed(CurrentVersion, $"Could not check for app updates. {ex.Message}");
        }
    }

    private static string ResolveCurrentVersion()
    {
        var assembly = Assembly.GetEntryAssembly() ?? typeof(UpdateService).Assembly;
        var informationalVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;

        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            return informationalVersion.Split('+')[0];
        }

        return assembly.GetName().Version?.ToString(3) ?? "0.0.0";
    }

    private static bool IsRemoteNewer(string remoteVersion, string currentVersion)
    {
        return TryParseVersion(remoteVersion, out var remote)
            && TryParseVersion(currentVersion, out var current)
            && remote.CompareTo(current) > 0;
    }

    private static bool TryParseVersion(string value, out Version version)
    {
        var normalized = value.Split('-', '+')[0];
        if (Version.TryParse(normalized, out var parsed))
        {
            version = parsed;
            return true;
        }

        version = new Version(0, 0, 0);
        return false;
    }
}
