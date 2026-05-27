using System.Net.Http;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using MukundTube.Models;
using MukundTube.Services;
using MukundTube.ViewModels;

namespace MukundTube;

public partial class MainWindow : Window
{
    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(30)
    };

    private readonly MainViewModel _viewModel;
    private readonly YouTubePlayerController _player;
    private readonly UpdateService _updateService;
    private CancellationTokenSource? _refreshCancellation;
    private CancellationTokenSource? _updateCancellation;

    public MainWindow()
    {
        InitializeComponent();
        ApplyFullscreenMode();

        var settings = SettingsService.Load();
        var configService = new ConfigService(_httpClient, settings.ConfigUrl, CachePaths.CachedConfigPath);
        var youTubeClient = new YouTubeDataApiClient(_httpClient);
        var feedService = new FeedService(youTubeClient);

        _viewModel = new MainViewModel(configService, feedService, settings);
        _player = new YouTubePlayerController(PlayerWebView, settings.AppReferrer);
        _updateService = new UpdateService(
            _httpClient,
            settings.UpdateManifestUrl);

        _player.UnauthorizedPlaybackDetected += (_, videoId) =>
        {
            Dispatcher.Invoke(() =>
            {
                _viewModel.SelectedVideo = null;
                _viewModel.StatusText = $"Blocked an unapproved video: {videoId}.";
            });
        };

        _player.PlayerError += (_, code) =>
        {
            Dispatcher.Invoke(() =>
            {
                _viewModel.StatusText = $"YouTube player error: {code}. The video may be unavailable or embedding may be disabled.";
            });
        };

        DataContext = _viewModel;
        SourceInitialized += (_, _) => ApplyFullscreenMode();
        Loaded += MainWindow_Loaded;
        Closed += MainWindow_Closed;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        ApplyFullscreenMode();

        var updateResult = await _updateService.CheckAsync(CancellationToken.None)
            .ConfigureAwait(true);
        _viewModel.ApplyUpdateResult(updateResult);
        StartUpdateMonitor();

        if (_viewModel.IsUpdateRequired)
        {
            return;
        }

        await _player.InitializeAsync().ConfigureAwait(true);
        await RefreshFeedAsync().ConfigureAwait(true);
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        await RefreshFeedAsync().ConfigureAwait(true);
    }

    private async void ChannelList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_viewModel.SelectedChannel is not ChannelItem channel)
        {
            return;
        }

        _refreshCancellation?.Cancel();
        _refreshCancellation?.Dispose();
        _refreshCancellation = new CancellationTokenSource();

        await _player.StopAsync().ConfigureAwait(true);
        await _viewModel.SelectChannelAsync(channel, _refreshCancellation.Token).ConfigureAwait(true);
        _player.SetAllowedVideos(_viewModel.Videos.Select(video => video.VideoId));
    }

    private async void VideoList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_viewModel.SelectedVideo is not VideoItem video)
        {
            return;
        }

        await _player.PlayAsync(video).ConfigureAwait(true);
    }

    private async void Back_Click(object sender, RoutedEventArgs e)
    {
        await _player.StopAsync().ConfigureAwait(true);
        _viewModel.SelectedChannel = null;
        _viewModel.SelectedVideo = null;
        _viewModel.Videos.Clear();
        _player.SetAllowedVideos([]);
        _viewModel.StatusText = "";
    }

    private void InstallUpdate_Click(object sender, RoutedEventArgs e)
    {
        if (!Uri.TryCreate(_viewModel.UpdateDownloadUrl, UriKind.Absolute, out var updateUri))
        {
            _viewModel.StatusText = "Update URL is missing or invalid.";
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = updateUri.ToString(),
            UseShellExecute = true
        });

        Close();
    }

    private async Task RefreshFeedAsync()
    {
        _refreshCancellation?.Cancel();
        _refreshCancellation?.Dispose();
        _refreshCancellation = new CancellationTokenSource();

        await _viewModel.RefreshAsync(_refreshCancellation.Token).ConfigureAwait(true);
        _player.SetAllowedVideos([]);
    }

    private void MainWindow_Closed(object? sender, EventArgs e)
    {
        _refreshCancellation?.Cancel();
        _refreshCancellation?.Dispose();
        _updateCancellation?.Cancel();
        _updateCancellation?.Dispose();
        _httpClient.Dispose();
    }

    private void StartUpdateMonitor()
    {
        _updateCancellation?.Cancel();
        _updateCancellation?.Dispose();
        _updateCancellation = new CancellationTokenSource();
        _ = MonitorForUpdatesAsync(_updateCancellation.Token);
    }

    private void ApplyFullscreenMode()
    {
        WindowState = WindowState.Normal;
        WindowState = WindowState.Maximized;
    }

    private async Task MonitorForUpdatesAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));

        try
        {
            while (await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(true))
            {
                var updateResult = await _updateService.CheckAsync(cancellationToken)
                    .ConfigureAwait(true);
                _viewModel.ApplyUpdateResult(updateResult);
                if (_viewModel.IsUpdateRequired)
                {
                    await _player.StopAsync().ConfigureAwait(true);
                    _player.SetAllowedVideos([]);
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
    }
}
