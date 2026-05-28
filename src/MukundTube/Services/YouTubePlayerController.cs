using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using MukundTube.Models;

namespace MukundTube.Services;

public sealed class YouTubePlayerController
{
    private const string PlayerHost = "app.mukundtube.local";
    private const string PlayerOrigin = "https://" + PlayerHost;
    private readonly WebView2 _webView;
    private readonly string _appReferrer;
    private HashSet<string> _allowedVideoIds = new(StringComparer.Ordinal);
    private bool _initialized;

    public YouTubePlayerController(WebView2 webView, string appReferrer)
    {
        _webView = webView;
        _appReferrer = PlayerOrigin + "/";
    }

    public event EventHandler<string>? UnauthorizedPlaybackDetected;

    public event EventHandler<string>? PlayerError;

    public async Task InitializeAsync()
    {
        if (_initialized)
        {
            return;
        }

        Directory.CreateDirectory(CachePaths.WebView2UserDataDirectory);
        var environment = await CoreWebView2Environment.CreateAsync(
                userDataFolder: CachePaths.WebView2UserDataDirectory)
            .ConfigureAwait(true);

        await _webView.EnsureCoreWebView2Async(environment).ConfigureAwait(true);

        var core = _webView.CoreWebView2;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.AreBrowserAcceleratorKeysEnabled = false;

        var assetsPath = Path.Combine(AppContext.BaseDirectory, "Assets");
        core.SetVirtualHostNameToFolderMapping(
            PlayerHost,
            assetsPath,
            CoreWebView2HostResourceAccessKind.DenyCors);

        core.NavigationStarting += OnNavigationStarting;
        core.NewWindowRequested += OnNewWindowRequested;
        core.WebMessageReceived += OnWebMessageReceived;
        core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += OnWebResourceRequested;

        _initialized = true;
    }

    public void SetAllowedVideos(IEnumerable<string> videoIds)
    {
        _allowedVideoIds = videoIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToHashSet(StringComparer.Ordinal);
    }

    public async Task PlayAsync(VideoItem video)
    {
        await InitializeAsync().ConfigureAwait(true);

        if (!_allowedVideoIds.Contains(video.VideoId))
        {
            UnauthorizedPlaybackDetected?.Invoke(this, video.VideoId);
            await StopAsync().ConfigureAwait(true);
            return;
        }

        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        var url = $"{PlayerOrigin}/player.html?videoId={Uri.EscapeDataString(video.VideoId)}";
        _webView.CoreWebView2.Navigate(url);
    }

    public async Task StopAsync()
    {
        if (!_initialized)
        {
            return;
        }

        try
        {
            await _webView.CoreWebView2.ExecuteScriptAsync("window.stopPlayer && window.stopPlayer();")
                .ConfigureAwait(true);
        }
        catch (InvalidOperationException)
        {
            // Navigation may already have torn down the page.
        }

        _webView.CoreWebView2.Navigate("about:blank");
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs args)
    {
        if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri))
        {
            args.Cancel = true;
            return;
        }

        if (uri.Scheme.Equals("about", StringComparison.OrdinalIgnoreCase)
            || uri.Host.Equals(PlayerHost, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        args.Cancel = true;
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs args)
    {
        args.Handled = true;
    }

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs args)
    {
        if (!Uri.TryCreate(args.Request.Uri, UriKind.Absolute, out var uri))
        {
            return;
        }

        if (!IsYouTubePlayerRequest(uri))
        {
            return;
        }

        try
        {
            args.Request.Headers.SetHeader("Referer", _appReferrer);
        }
        catch (ArgumentException)
        {
        }
        catch (InvalidOperationException)
        {
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        PlayerMessage? message;
        try
        {
            message = JsonSerializer.Deserialize<PlayerMessage>(args.WebMessageAsJson, JsonDefaults.Options);
        }
        catch (JsonException)
        {
            return;
        }

        if (message is null)
        {
            return;
        }

        if (string.Equals(message.Type, "video", StringComparison.Ordinal)
            && !string.IsNullOrWhiteSpace(message.VideoId)
            && !_allowedVideoIds.Contains(message.VideoId))
        {
            UnauthorizedPlaybackDetected?.Invoke(this, message.VideoId);
            _ = StopAsync();
        }

        if (string.Equals(message.Type, "error", StringComparison.Ordinal)
            && !string.IsNullOrWhiteSpace(message.Code))
        {
            PlayerError?.Invoke(this, message.Code);
        }
    }

    private static bool IsYouTubePlayerRequest(Uri uri)
    {
        return uri.Host.EndsWith("youtube.com", StringComparison.OrdinalIgnoreCase)
            || uri.Host.EndsWith("youtube-nocookie.com", StringComparison.OrdinalIgnoreCase)
            || uri.Host.EndsWith("ytimg.com", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record PlayerMessage
    {
        public string Type { get; init; } = "";

        public string VideoId { get; init; } = "";

        public string Code { get; init; } = "";
    }
}

