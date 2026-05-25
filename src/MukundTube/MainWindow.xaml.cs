using System.Net.Http;
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
    private CancellationTokenSource? _refreshCancellation;

    public MainWindow()
    {
        InitializeComponent();

        var settings = SettingsService.Load();
        var configService = new ConfigService(_httpClient, settings.ConfigUrl, CachePaths.CachedConfigPath);
        var youTubeClient = new YouTubeDataApiClient(_httpClient);
        var feedService = new FeedService(youTubeClient);

        _viewModel = new MainViewModel(configService, feedService, settings);
        _player = new YouTubePlayerController(PlayerWebView, settings.AppReferrer);

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
        Loaded += MainWindow_Loaded;
        Closed += MainWindow_Closed;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        await _player.InitializeAsync().ConfigureAwait(true);
        await RefreshFeedAsync().ConfigureAwait(true);
    }

    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        await RefreshFeedAsync().ConfigureAwait(true);
    }

    private async void VideoList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_viewModel.SelectedVideo is not VideoItem video)
        {
            return;
        }

        await _player.PlayAsync(video).ConfigureAwait(true);
    }

    private async Task RefreshFeedAsync()
    {
        _refreshCancellation?.Cancel();
        _refreshCancellation?.Dispose();
        _refreshCancellation = new CancellationTokenSource();

        await _viewModel.RefreshAsync(_refreshCancellation.Token).ConfigureAwait(true);
        _player.SetAllowedVideos(_viewModel.Videos.Select(video => video.VideoId));
    }

    private void MainWindow_Closed(object? sender, EventArgs e)
    {
        _refreshCancellation?.Cancel();
        _refreshCancellation?.Dispose();
        _httpClient.Dispose();
    }
}

