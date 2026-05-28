using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Xml;
using MukundTube.Models;

namespace MukundTube.Services;

public sealed class YouTubeDataApiClient
{
    private const string ApiBaseUrl = "https://www.googleapis.com/youtube/v3";
    private readonly HttpClient _httpClient;

    public YouTubeDataApiClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<VideoItem>> GetLatestChannelVideosAsync(
        string channelId,
        int maxResults,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var uploadsPlaylistId = await GetUploadsPlaylistIdAsync(channelId, apiKey, cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(uploadsPlaylistId))
        {
            return [];
        }

        var response = await GetPlaylistItemsAsync(uploadsPlaylistId, maxResults, apiKey, cancellationToken)
            .ConfigureAwait(false);

        var videoIds = response
            .Select(ToVideoItem)
            .Where(video => !string.IsNullOrWhiteSpace(video.VideoId))
            .Where(video => !IsPlaceholderTitle(video.Title))
            .Select(video => video.VideoId)
            .ToArray();

        return await GetVideosByIdsAsync(videoIds, apiKey, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<ChannelItem>> GetChannelsAsync(
        IEnumerable<ChannelConfig> configuredChannels,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var channelConfigs = configuredChannels
            .Where(channel => channel.Enabled)
            .Where(channel => !string.IsNullOrWhiteSpace(channel.ChannelId))
            .ToArray();

        var configuredTitles = channelConfigs.ToDictionary(
            channel => channel.ChannelId,
            channel => channel.Title,
            StringComparer.Ordinal);

        var results = new List<ChannelItem>();
        foreach (var batch in channelConfigs.Select(channel => channel.ChannelId).Distinct(StringComparer.Ordinal).Chunk(50))
        {
            var joinedIds = string.Join(",", batch.Select(Uri.EscapeDataString));
            var url =
                $"{ApiBaseUrl}/channels?part=snippet,contentDetails&id={joinedIds}&key={Uri.EscapeDataString(apiKey)}";
            var response = await SendAsync<ChannelsResponse>(url, cancellationToken).ConfigureAwait(false);

            results.AddRange(response.Items.Select(channel => ToChannelItem(channel, configuredTitles)));
        }

        return results
            .Where(channel => !string.IsNullOrWhiteSpace(channel.ChannelId))
            .ToArray();
    }

    public async Task<IReadOnlyList<VideoItem>> GetVideosByIdsAsync(
        IEnumerable<string> videoIds,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var results = new List<VideoItem>();
        foreach (var batch in videoIds.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct(StringComparer.Ordinal).Chunk(50))
        {
            var joinedIds = string.Join(",", batch.Select(Uri.EscapeDataString));
            var url =
                $"{ApiBaseUrl}/videos?part=snippet,status,contentDetails&id={joinedIds}&key={Uri.EscapeDataString(apiKey)}";
            var response = await SendAsync<VideosResponse>(url, cancellationToken).ConfigureAwait(false);

            results.AddRange(response.Items
                .Where(item => item.Status?.Embeddable != false)
                .Where(item => string.Equals(item.Status?.PrivacyStatus, "public", StringComparison.OrdinalIgnoreCase)
                    || string.IsNullOrWhiteSpace(item.Status?.PrivacyStatus))
                .Select(ToVideoItem)
                .Where(video => !string.IsNullOrWhiteSpace(video.VideoId))
                .Where(video => !IsPlaceholderTitle(video.Title)));
        }

        return results;
    }

    private async Task<string?> GetUploadsPlaylistIdAsync(string channelId, string apiKey, CancellationToken cancellationToken)
    {
        var url =
            $"{ApiBaseUrl}/channels?part=contentDetails&id={Uri.EscapeDataString(channelId)}&key={Uri.EscapeDataString(apiKey)}";
        var response = await SendAsync<ChannelsResponse>(url, cancellationToken).ConfigureAwait(false);
        return response.Items.FirstOrDefault()?.ContentDetails?.RelatedPlaylists?.Uploads;
    }

    private async Task<IReadOnlyList<PlaylistItemResource>> GetPlaylistItemsAsync(
        string playlistId,
        int maxResults,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var requestedResults = Math.Clamp(maxResults, 1, 200);
        var remaining = requestedResults;
        var pageToken = "";
        var results = new List<PlaylistItemResource>();

        while (remaining > 0)
        {
            var pageSize = Math.Min(remaining, 50);
            var pageTokenParameter = string.IsNullOrWhiteSpace(pageToken)
                ? ""
                : $"&pageToken={Uri.EscapeDataString(pageToken)}";
            var url =
                $"{ApiBaseUrl}/playlistItems?part=snippet,contentDetails&playlistId={Uri.EscapeDataString(playlistId)}&maxResults={pageSize}{pageTokenParameter}&key={Uri.EscapeDataString(apiKey)}";
            var response = await SendAsync<PlaylistItemsResponse>(url, cancellationToken).ConfigureAwait(false);

            results.AddRange(response.Items);
            remaining = requestedResults - results.Count;

            if (string.IsNullOrWhiteSpace(response.NextPageToken) || response.Items.Count == 0)
            {
                break;
            }

            pageToken = response.NextPageToken;
        }

        return results;
    }

    private static ChannelItem ToChannelItem(ChannelResource item, IReadOnlyDictionary<string, string> configuredTitles)
    {
        var snippet = item.Snippet ?? new ChannelSnippet();
        var channelId = item.Id ?? "";

        return new ChannelItem
        {
            ChannelId = channelId,
            Title = configuredTitles.TryGetValue(channelId, out var configuredTitle) && !string.IsNullOrWhiteSpace(configuredTitle)
                ? configuredTitle
                : WebUtility.HtmlDecode(snippet.Title ?? ""),
            Description = WebUtility.HtmlDecode(snippet.Description ?? ""),
            ThumbnailUrl = PickThumbnail(snippet.Thumbnails),
            UploadsPlaylistId = item.ContentDetails?.RelatedPlaylists?.Uploads ?? ""
        };
    }

    private async Task<T> SendAsync<T>(string url, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync(url, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

        if (response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized)
        {
            throw new YouTubeApiException((int)response.StatusCode, body);
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new YouTubeApiException((int)response.StatusCode, body);
        }

        return JsonSerializer.Deserialize<T>(body, JsonDefaults.Options)
            ?? throw new JsonException("YouTube API returned empty JSON.");
    }

    private static VideoItem ToVideoItem(PlaylistItemResource item)
    {
        var snippet = item.Snippet ?? new PlaylistItemSnippet();
        var videoId = item.ContentDetails?.VideoId ?? snippet.ResourceId?.VideoId ?? "";

        return new VideoItem
        {
            VideoId = videoId,
            Title = WebUtility.HtmlDecode(snippet.Title ?? ""),
            ChannelId = snippet.VideoOwnerChannelId ?? snippet.ChannelId ?? "",
            ChannelTitle = WebUtility.HtmlDecode(snippet.VideoOwnerChannelTitle ?? snippet.ChannelTitle ?? ""),
            PublishedAt = item.ContentDetails?.VideoPublishedAt ?? snippet.PublishedAt,
            ThumbnailUrl = PickThumbnail(snippet.Thumbnails)
        };
    }

    private static VideoItem ToVideoItem(VideoResource item)
    {
        var snippet = item.Snippet ?? new VideoSnippet();

        return new VideoItem
        {
            VideoId = item.Id ?? "",
            Title = WebUtility.HtmlDecode(snippet.Title ?? ""),
            ChannelId = snippet.ChannelId ?? "",
            ChannelTitle = WebUtility.HtmlDecode(snippet.ChannelTitle ?? ""),
            PublishedAt = snippet.PublishedAt,
            ThumbnailUrl = PickThumbnail(snippet.Thumbnails),
            Duration = ParseDuration(item.ContentDetails?.Duration)
        };
    }

    private static TimeSpan? ParseDuration(string? duration)
    {
        if (string.IsNullOrWhiteSpace(duration))
        {
            return null;
        }

        try
        {
            return XmlConvert.ToTimeSpan(duration);
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private static string PickThumbnail(IReadOnlyDictionary<string, Thumbnail>? thumbnails)
    {
        if (thumbnails is null)
        {
            return "";
        }

        foreach (var key in new[] { "maxres", "standard", "high", "medium", "default" })
        {
            if (thumbnails.TryGetValue(key, out var thumbnail) && !string.IsNullOrWhiteSpace(thumbnail.Url))
            {
                return thumbnail.Url;
            }
        }

        return "";
    }

    private static bool IsPlaceholderTitle(string title)
    {
        return title.Equals("Private video", StringComparison.OrdinalIgnoreCase)
            || title.Equals("Deleted video", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record ChannelsResponse
    {
        public IReadOnlyList<ChannelResource> Items { get; init; } = [];
    }

    private sealed record ChannelResource
    {
        public string? Id { get; init; }

        public ChannelSnippet? Snippet { get; init; }

        public ChannelContentDetails? ContentDetails { get; init; }
    }

    private sealed record ChannelSnippet
    {
        public string? Title { get; init; }

        public string? Description { get; init; }

        public IReadOnlyDictionary<string, Thumbnail>? Thumbnails { get; init; }
    }

    private sealed record ChannelContentDetails
    {
        public RelatedPlaylists? RelatedPlaylists { get; init; }
    }

    private sealed record RelatedPlaylists
    {
        public string? Uploads { get; init; }
    }

    private sealed record PlaylistItemsResponse
    {
        public IReadOnlyList<PlaylistItemResource> Items { get; init; } = [];

        public string? NextPageToken { get; init; }
    }

    private sealed record PlaylistItemResource
    {
        public PlaylistItemSnippet? Snippet { get; init; }

        public PlaylistItemContentDetails? ContentDetails { get; init; }
    }

    private sealed record PlaylistItemSnippet
    {
        public DateTimeOffset PublishedAt { get; init; }

        public string? ChannelId { get; init; }

        public string? ChannelTitle { get; init; }

        public string? Title { get; init; }

        public ResourceId? ResourceId { get; init; }

        public IReadOnlyDictionary<string, Thumbnail>? Thumbnails { get; init; }

        public string? VideoOwnerChannelTitle { get; init; }

        public string? VideoOwnerChannelId { get; init; }
    }

    private sealed record ResourceId
    {
        public string? VideoId { get; init; }
    }

    private sealed record PlaylistItemContentDetails
    {
        public string? VideoId { get; init; }

        public DateTimeOffset? VideoPublishedAt { get; init; }
    }

    private sealed record VideosResponse
    {
        public IReadOnlyList<VideoResource> Items { get; init; } = [];
    }

    private sealed record VideoResource
    {
        public string? Id { get; init; }

        public VideoSnippet? Snippet { get; init; }

        public VideoStatus? Status { get; init; }

        public VideoContentDetails? ContentDetails { get; init; }
    }

    private sealed record VideoSnippet
    {
        public DateTimeOffset PublishedAt { get; init; }

        public string? ChannelId { get; init; }

        public string? ChannelTitle { get; init; }

        public string? Title { get; init; }

        public IReadOnlyDictionary<string, Thumbnail>? Thumbnails { get; init; }
    }

    private sealed record VideoStatus
    {
        public string? PrivacyStatus { get; init; }

        public bool? Embeddable { get; init; }

        [JsonPropertyName("madeForKids")]
        public bool? MadeForKids { get; init; }
    }

    private sealed record VideoContentDetails
    {
        public string? Duration { get; init; }
    }

    private sealed record Thumbnail
    {
        public string? Url { get; init; }
    }
}
