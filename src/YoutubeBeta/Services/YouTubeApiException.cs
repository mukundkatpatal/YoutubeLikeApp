namespace YoutubeBeta.Services;

public sealed class YouTubeApiException : Exception
{
    public YouTubeApiException(int statusCode, string responseBody)
        : base($"YouTube API request failed with HTTP {statusCode}: {Trim(responseBody)}")
    {
        StatusCode = statusCode;
    }

    public int StatusCode { get; }

    private static string Trim(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "No response body.";
        }

        return value.Length <= 500 ? value : value[..500] + "...";
    }
}

