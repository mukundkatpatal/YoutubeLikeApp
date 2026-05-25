using MukundTube.Models;

namespace MukundTube.Services;

public sealed record ConfigLoadResult(
    AppConfig Config,
    bool UsedCachedConfig,
    bool HasUsableConfig,
    string Message);

