import brandConfigJson from '../../brand.config.json';

export interface BrandsiteConfigType {
    brand_name: string;
    domain_name: string;
    primary_color: string;
    secondary_color: string;
    whatsapp_url: string;
    telegram_url: string;
    youtube_url: string;
    support_email: string;
    support_phone: string;
    oauth_app_id: string;
    oauth_client_id: string;
}

const BRANDSITE_CONFIG_KEY = 'brandsite_config';

export const getBrandConfig = (): BrandsiteConfigType => {
    const defaultConfig: BrandsiteConfigType = {
        brand_name: brandConfigJson.brand_name || 'Protool',
        domain_name: brandConfigJson.domain_name || 'protool.com',
        primary_color: '#1e40af', // Default primary blue from themes.scss
        secondary_color: '#10b981', // Default secondary green
        whatsapp_url: '',
        telegram_url: '',
        youtube_url: '',
        support_email: '',
        support_phone: '',
        oauth_app_id: brandConfigJson.oauth?.app_id ? String(brandConfigJson.oauth.app_id) : '',
        oauth_client_id: brandConfigJson.oauth?.client_id || '',
    };

    const configStr = localStorage.getItem(BRANDSITE_CONFIG_KEY);
    if (configStr) {
        try {
            const parsed = JSON.parse(configStr);
            return { ...defaultConfig, ...parsed };
        } catch (e) {
            console.error('Error parsing brandsite_config from localStorage', e);
        }
    }
    return defaultConfig;
};

export const saveBrandConfig = (config: Partial<BrandsiteConfigType>) => {
    const currentConfig = getBrandConfig();
    const updatedConfig = { ...currentConfig, ...config };
    localStorage.setItem(BRANDSITE_CONFIG_KEY, JSON.stringify(updatedConfig));

    // Also update separate individual keys that other files might read directly
    if (config.oauth_app_id !== undefined) {
        localStorage.setItem('configured_app_id', config.oauth_app_id);
        localStorage.setItem('config.app_id', config.oauth_app_id);
    }
    if (config.oauth_client_id !== undefined) {
        localStorage.setItem('configured_client_id', config.oauth_client_id);
    }
};

export const adjustColorBrightness = (hex: string, percent: number): string => {
    // Basic validation
    if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;

    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = parseInt(String((R * (100 + percent)) / 100), 10);
    G = parseInt(String((G * (100 + percent)) / 100), 10);
    B = parseInt(String((B * (100 + percent)) / 100), 10);

    R = R < 255 ? R : 255;
    G = G < 255 ? G : 255;
    B = B < 255 ? B : 255;

    R = R > 0 ? R : 0;
    G = G > 0 ? G : 0;
    B = B > 0 ? B : 0;

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
};

export const applyBrandColors = (primary?: string, secondary?: string) => {
    if (typeof window === 'undefined') return;
    const config = getBrandConfig();
    const p = primary || config.primary_color;
    const s = secondary || config.secondary_color;

    if (p) {
        document.body.style.setProperty('--button-primary-default', p);
        document.body.style.setProperty('--button-primary-hover', adjustColorBrightness(p, -12));
        document.body.style.setProperty('--brand-red-coral', p);
    }
    if (s) {
        document.body.style.setProperty('--brand-secondary', s);
        document.body.style.setProperty('--border-active', s);
        document.body.style.setProperty('--fill-active', s);
    }
};
