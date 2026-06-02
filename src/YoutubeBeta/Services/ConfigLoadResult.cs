using YoutubeBeta.Models;

namespace YoutubeBeta.Services;

public sealed record ConfigLoadResult(
    AppConfig Config,
    bool UsedCachedConfig,
    bool HasUsableConfig,
    string Message);

