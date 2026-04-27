const GITHUB_REPO = 'JavierParedesDev/ActualizacionPanaderiaMatias';
const CURRENT_VERSION = '1.0.0';

export async function checkUpdates() {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
        if (!response.ok) throw new Error('No se pudo conectar con el servidor de actualizaciones.');

        const data = await response.json();
        const latestVersion = data.tag_name.replace('v', '');

        return {
            current: CURRENT_VERSION,
            latest: latestVersion,
            hasUpdate: isNewer(latestVersion, CURRENT_VERSION),
            url: data.html_url,
            description: data.body
        };
    } catch (error) {
        console.error('Error checking updates:', error);
        throw error;
    }
}

function isNewer(latest, current) {
    const l = latest.split('.').map(Number);
    const c = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (l[i] > c[i]) return true;
        if (l[i] < c[i]) return false;
    }
    return false;
}
