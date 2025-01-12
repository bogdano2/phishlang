document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const reportedUrl = urlParams.get('url');

    if (reportedUrl) {
        document.getElementById('reported-url').textContent = reportedUrl;
    }

    // Add click handler for the Back to Safety button
    document.getElementById('back-to-safety').addEventListener('click', function() {
        chrome.tabs.update({ url: 'chrome://newtab' });
    });
});
