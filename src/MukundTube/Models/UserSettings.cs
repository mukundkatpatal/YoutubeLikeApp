namespace MukundTube.Models;

public sealed record UserSettings
{
    public const string DefaultConfigUrl =
        "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json";

    public string ConfigUrl { get; init; } = DefaultConfigUrl;

    public string YouTubeApiKey { get; init; } = "";

    public string AppReferrer { get; init; } = "https://mukundtube.local/";
}

