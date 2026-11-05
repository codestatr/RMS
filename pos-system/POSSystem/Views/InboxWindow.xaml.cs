using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using RMS.POSSystem.Services;

namespace RMS.POSSystem.Views
{
    public partial class InboxWindow : Window
    {
        private readonly InboxService _inboxService;
        private readonly ObservableCollection<InboxMessage> _messages = new ObservableCollection<InboxMessage>();

        public InboxWindow(InboxService inboxService)
        {
            InitializeComponent();
            _inboxService = inboxService;
            InboxList.ItemsSource = _messages;
            Loaded += async (_, _) => await RefreshMessagesAsync();
        }

        private async Task RefreshMessagesAsync()
        {
            TxtInboxError.Visibility = Visibility.Collapsed;
            try
            {
                var messages = await _inboxService.GetMessagesAsync();
                _messages.Clear();
                foreach (var message in messages) _messages.Add(message);
                var unread = messages.Count(message => !message.IsRead);
                TxtInboxSummary.Text = $"{unread} unread · {messages.Count} messages";
                TxtInboxEmpty.Visibility = messages.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            }
            catch (Exception ex)
            {
                TxtInboxError.Text = $"Could not load messages: {ex.Message}";
                TxtInboxError.Visibility = Visibility.Visible;
                TxtInboxEmpty.Visibility = Visibility.Collapsed;
            }
        }

        private async void Refresh_Click(object sender, RoutedEventArgs e) => await RefreshMessagesAsync();

        private async void MarkRead_Click(object sender, RoutedEventArgs e)
        {
            if ((sender as Button)?.DataContext is not InboxMessage message) return;
            try
            {
                await _inboxService.MarkReadAsync(message.Id);
                await RefreshMessagesAsync();
            }
            catch (Exception ex)
            {
                TxtInboxError.Text = $"Could not mark the message as read: {ex.Message}";
                TxtInboxError.Visibility = Visibility.Visible;
            }
        }

        private void Close_Click(object sender, RoutedEventArgs e) => Close();
    }
}
