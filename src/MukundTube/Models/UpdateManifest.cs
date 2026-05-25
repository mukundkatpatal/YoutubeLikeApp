namespace MukundTube.Models;

public sealed record UpdateManifest
{
    public string Version { get; init; } = "";

    public bool Required { get; init; }

    public string DownloadUrl { get; init; } = "";

    public string Notes { get; init; } = "";

    public DateTimeOffset? PublishedAt { get; init; }
}
