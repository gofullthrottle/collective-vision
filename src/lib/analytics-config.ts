/**
 * Third-Party Analytics Configuration
 * Supports GA4, Microsoft Clarity, and custom tracking pixels
 */

export interface GoogleAnalyticsConfig {
  measurement_id: string;
  enabled: boolean;
  send_page_views?: boolean;
  debug_mode?: boolean;
}

export interface MicrosoftClarityConfig {
  project_id: string;
  enabled: boolean;
}

export interface CustomPixelConfig {
  id: string;
  name: string;
  type: 'facebook' | 'linkedin' | 'twitter' | 'custom';
  pixel_id?: string;
  custom_script?: string;
  enabled: boolean;
  events: string[]; // Which events to fire: feedback_view, feedback_submit, feedback_vote, board_view
}

export interface AnalyticsConfig {
  google_analytics?: GoogleAnalyticsConfig;
  microsoft_clarity?: MicrosoftClarityConfig;
  custom_pixels?: CustomPixelConfig[];
  consent_required?: boolean;
  anonymize_ip?: boolean;
}

// Event types that can be tracked
export type AnalyticsEventType =
  | 'page_view'
  | 'board_view'
  | 'feedback_view'
  | 'feedback_submit'
  | 'feedback_vote'
  | 'comment_submit'
  | 'widget_open'
  | 'widget_close';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  properties?: Record<string, string | number | boolean>;
  timestamp?: string;
}

/**
 * Generate the analytics injection script for the widget
 */
export function generateAnalyticsScript(config: AnalyticsConfig): string {
  const scripts: string[] = [];

  // Google Analytics 4
  if (config.google_analytics?.enabled && config.google_analytics.measurement_id) {
    const gaConfig = config.google_analytics;
    scripts.push(`
      // Google Analytics 4
      (function() {
        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=${gaConfig.measurement_id}';
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaConfig.measurement_id}'${gaConfig.debug_mode ? ", { 'debug_mode': true }" : ''});

        window.cvAnalytics = window.cvAnalytics || {};
        window.cvAnalytics.ga4 = function(eventName, params) {
          gtag('event', eventName, params);
        };
      })();
    `);
  }

  // Microsoft Clarity
  if (config.microsoft_clarity?.enabled && config.microsoft_clarity.project_id) {
    scripts.push(`
      // Microsoft Clarity
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${config.microsoft_clarity.project_id}");
    `);
  }

  // Custom Pixels
  if (config.custom_pixels?.length) {
    for (const pixel of config.custom_pixels) {
      if (!pixel.enabled) continue;

      switch (pixel.type) {
        case 'facebook':
          if (pixel.pixel_id) {
            scripts.push(`
              // Facebook Pixel: ${pixel.name}
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixel.pixel_id}');
              fbq('track', 'PageView');

              window.cvAnalytics = window.cvAnalytics || {};
              window.cvAnalytics.fbq = function(eventName, params) {
                fbq('track', eventName, params);
              };
            `);
          }
          break;

        case 'linkedin':
          if (pixel.pixel_id) {
            scripts.push(`
              // LinkedIn Insight Tag: ${pixel.name}
              _linkedin_partner_id = "${pixel.pixel_id}";
              window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
              window._linkedin_data_partner_ids.push(_linkedin_partner_id);
              (function(l) {
                if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
                window.lintrk.q=[]}
                var s = document.getElementsByTagName("script")[0];
                var b = document.createElement("script");
                b.type = "text/javascript";b.async = true;
                b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
                s.parentNode.insertBefore(b, s);})(window.lintrk);
            `);
          }
          break;

        case 'twitter':
          if (pixel.pixel_id) {
            scripts.push(`
              // Twitter Pixel: ${pixel.name}
              !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
              },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
              a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
              twq('config','${pixel.pixel_id}');
            `);
          }
          break;

        case 'custom':
          if (pixel.custom_script) {
            scripts.push(`
              // Custom Pixel: ${pixel.name}
              try {
                ${pixel.custom_script}
              } catch (e) {
                console.warn('Custom analytics pixel error:', e);
              }
            `);
          }
          break;
      }
    }
  }

  // Add unified event tracking helper
  scripts.push(`
    // Collective Vision Analytics Helper
    window.cvTrackEvent = function(eventType, properties) {
      var props = properties || {};
      props.cv_event_type = eventType;
      props.cv_timestamp = new Date().toISOString();

      // GA4
      if (window.cvAnalytics && window.cvAnalytics.ga4) {
        window.cvAnalytics.ga4('cv_' + eventType, props);
      }

      // Facebook
      if (window.cvAnalytics && window.cvAnalytics.fbq) {
        window.cvAnalytics.fbq('cv_' + eventType, props);
      }

      // LinkedIn
      if (window.lintrk) {
        window.lintrk('track', { conversion_id: eventType });
      }

      // Twitter
      if (window.twq) {
        window.twq('event', 'tw-' + eventType, props);
      }
    };
  `);

  return scripts.join('\n');
}

/**
 * Validate analytics configuration
 */
export function validateAnalyticsConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: true, errors: [] }; // Empty config is valid
  }

  const cfg = config as Record<string, unknown>;

  // Validate GA4
  if (cfg.google_analytics) {
    const ga = cfg.google_analytics as Record<string, unknown>;
    if (ga.enabled && !ga.measurement_id) {
      errors.push('Google Analytics enabled but measurement_id is missing');
    }
    if (ga.measurement_id && typeof ga.measurement_id === 'string' && !ga.measurement_id.startsWith('G-')) {
      errors.push('Google Analytics measurement_id should start with "G-"');
    }
  }

  // Validate Clarity
  if (cfg.microsoft_clarity) {
    const clarity = cfg.microsoft_clarity as Record<string, unknown>;
    if (clarity.enabled && !clarity.project_id) {
      errors.push('Microsoft Clarity enabled but project_id is missing');
    }
  }

  // Validate custom pixels
  if (cfg.custom_pixels && Array.isArray(cfg.custom_pixels)) {
    for (let i = 0; i < cfg.custom_pixels.length; i++) {
      const pixel = cfg.custom_pixels[i] as Record<string, unknown>;
      if (!pixel.name) {
        errors.push(`Custom pixel ${i + 1} is missing a name`);
      }
      if (!pixel.type) {
        errors.push(`Custom pixel "${pixel.name || i + 1}" is missing a type`);
      }
      if (pixel.type !== 'custom' && !pixel.pixel_id) {
        errors.push(`Custom pixel "${pixel.name || i + 1}" is missing pixel_id`);
      }
      if (pixel.type === 'custom' && !pixel.custom_script) {
        errors.push(`Custom pixel "${pixel.name || i + 1}" is missing custom_script`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
