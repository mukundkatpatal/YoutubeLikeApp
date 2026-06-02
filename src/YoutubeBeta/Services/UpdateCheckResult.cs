namespace YoutubeBeta.Services;

public sealed record UpdateCheckResult(
    bool UpdateAvailable,
    bool Required,
    string CurrentVersion,
    string LatestVersion,
    string DownloadUrl,
    string Notes,
    string Message)
{
    public static UpdateCheckResult Current(string currentVersion, string message) =>
        new(false, false, currentVersion, currentVersion, "", "", message);

    public static UpdateCheckResult Failed(string currentVersion, string message) =>
        new(false, false, currentVersion, currentVersion, "", "", message);
}
