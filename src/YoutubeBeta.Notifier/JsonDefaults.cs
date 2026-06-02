using System.Text.Json;

namespace YoutubeBeta.Notifier;

internal static class JsonDefaults
{
    public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };
}
