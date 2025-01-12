/**
 * @param {('phishing'|'suspicious'|'safe'|'checking'|'error')|string} event
 * @param {object} callbacks
 * @param {() => Promise<void>} callbacks.onPhishing
 * @param {() => Promise<void>} callbacks.onSuspicious
 * @param {() => Promise<void>} callbacks.onSafe
 * @param {(() => Promise<void>)|undefined} [callbacks.onDefault]
 * @returns {Promise<void>}
 */
async function onPhishStatusAsync(event, callbacks) {
	try {
		if (!callbacks) {
			console.error('No callbacks provided to onPhishStatusAsync');
			return;
		}

		switch (event) {
			case 'phishing':
				if (callbacks.onPhishing) await callbacks.onPhishing();
				break;
			case 'suspicious':
				if (callbacks.onSuspicious) await callbacks.onSuspicious();
				break;
			case 'safe':
				if (callbacks.onSafe) await callbacks.onSafe();
				break;
			case 'checking':
			case 'error':
			default:
				if (callbacks.onDefault) {
					await callbacks.onDefault();
				} else if (callbacks.onSafe) {
					await callbacks.onSafe();
				}
				break;
		}
	} catch (error) {
		console.error('Error in onPhishStatusAsync:', error);
		// Don't throw the error, just log it
		if (callbacks.onDefault) {
			try {
				await callbacks.onDefault();
			} catch (e) {
				console.error('Error in default callback:', e);
			}
		}
	}
}

export { onPhishStatusAsync };
