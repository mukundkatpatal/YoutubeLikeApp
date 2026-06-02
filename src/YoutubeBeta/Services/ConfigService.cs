using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using YoutubeBeta.Models;

namespace YoutubeBeta.Services;

public sealed class ConfigService
{
    private readonly HttpClient _httpClient;
    private readonly string _configUrl;
    private readonly string _cachePath;

    public ConfigService(HttpClient httpClient, string configUrl, string cachePath)
    {
        _httpClient = httpClient;
        _configUrl = configUrl;
        _cachePath = cachePath;
    }

    public async Task<ConfigLoadResult> LoadAsync(CancellationToken cancellationToken)
    {
        var cachedConfig = await TryReadConfigAsync(_cachePath, cancellationToken).ConfigureAwait(false);

        try
        {
            using var response = await _httpClient.GetAsync(_configUrl, cancellationToken).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var remoteConfig = JsonSerializer.Deserialize<AppConfig>(json, JsonDefaults.Options);
            var errors = ConfigValidator.Validate(remoteConfig);

            if (errors.Count > 0)
            {
                throw new InvalidOperationException(string.Join(Environment.NewLine, errors));
            }

            Directory.CreateDirectory(Path.GetDirectoryName(_cachePath)!);
            await File.WriteAllTextAsync(_cachePath, json, cancellationToken).ConfigureAwait(false);

            return new ConfigLoadResult(remoteConfig!, UsedCachedConfig: false, HasUsableConfig: true, "Loaded remote config.");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
        {
            if (cachedConfig is not null)
            {
                return new ConfigLoadResult(
                    cachedConfig,
                    UsedCachedConfig: true,
                    HasUsableConfig: true,
                    $"Remote config unavailable or invalid; using last good config. {ex.Message}");
            }

            return new ConfigLoadResult(
                AppConfig.Empty,
                UsedCachedConfig: false,
                HasUsableConfig: false,
                $"No usable config found. {ex.Message}");
        }
    }

    private static async Task<AppConfig?> TryReadConfigAsync(string path, CancellationToken cancellationToken)
    {
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            var json = await File.ReadAllTextAsync(path, cancellationToken).ConfigureAwait(false);
            var config = JsonSerializer.Deserialize<AppConfig>(json, JsonDefaults.Options);
            return ConfigValidator.Validate(config).Count == 0 ? config : null;
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return null;
        }
    }
}

