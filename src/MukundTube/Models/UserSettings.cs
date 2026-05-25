namespace MukundTube.Models;

public sealed record UserSettings
{
    public const string DefaultConfigUrl =
        "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json";

    public const string DefaultUpdateManifestUrl =
        "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/update-manifest.json";

    public string ConfigUrl { get; init; } = DefaultConfigUrl;

    public string UpdateManifestUrl { get; init; } = DefaultUpdateManifestUrl;

    public string YouTubeApiKey { get; init; } = "";

    public string AppReferrer { get; init; } = "https://mukundtube.local/";
}
