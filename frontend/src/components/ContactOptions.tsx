import { useTranslation } from 'react-i18next';
import { INSTAGRAM_URL, LINKEDIN_URL, emailUrl, whatsappUrl } from '../lib/contact';

type Props = {
  // Mensaje ya traducido que se precarga en WhatsApp (y en el correo, si hay).
  message: string;
  // Texto opcional sobre los iconos (ya traducido).
  label?: string;
  autoFocus?: boolean;
  className?: string;
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        className="contact-option-stroke"
        d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.3z"
      />
      <path
        className="contact-option-fill"
        d="M9.1 7.6c.3-.3.8-.3 1 .1l.9 1.7c.2.3.1.7-.2 1l-.6.5c.5 1.1 1.4 2 2.5 2.5l.5-.6c.3-.3.7-.4 1-.2l1.7.9c.4.2.4.7.1 1l-.7.8c-.5.5-1.3.7-2 .4-2.2-.9-3.9-2.6-4.8-4.8-.3-.7-.1-1.5.4-2z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="contact-option-stroke" x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle className="contact-option-stroke" cx="12" cy="12" r="4" />
      <circle className="contact-option-fill" cx="17" cy="7" r="1.1" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="contact-option-stroke" x="3.5" y="3.5" width="17" height="17" rx="3" />
      <circle className="contact-option-fill" cx="8.2" cy="8.2" r="1.2" />
      <path className="contact-option-fill" d="M7.2 10.4h2v6.8h-2z" />
      <path
        className="contact-option-fill"
        d="M11 10.4h1.9v.9c.4-.7 1.2-1.1 2.1-1.1 1.6 0 2.5 1 2.5 2.9v4.1h-2v-3.7c0-.9-.4-1.4-1.1-1.4-.8 0-1.4.6-1.4 1.6v3.5h-2z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="contact-option-stroke" x="3" y="5.5" width="18" height="13" rx="2" />
      <path className="contact-option-stroke" d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  );
}

// Formas de contactar a Andrea, solo iconos: WhatsApp, Instagram, LinkedIn y
// correo. Reemplaza al botón que abría WhatsApp directo, para no asumir que
// todo el mundo lo tiene. El nombre de cada canal va en aria-label y title.
export default function ContactOptions({ message, label, autoFocus, className }: Props) {
  const { t } = useTranslation();
  const mail = emailUrl(message);

  return (
    <div className={`contact-options ${className ?? ''}`}>
      {label && <p className="contact-options-label">{label}</p>}
      <div className="contact-options-row">
        <a
          className="contact-option"
          href={whatsappUrl(message)}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('contact.whatsapp')}
          title={t('contact.whatsapp')}
          autoFocus={autoFocus}
        >
          <WhatsAppIcon />
        </a>
        <a
          className="contact-option"
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('contact.instagram')}
          title={t('contact.instagram')}
        >
          <InstagramIcon />
        </a>
        <a
          className="contact-option"
          href={LINKEDIN_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('contact.linkedin')}
          title={t('contact.linkedin')}
        >
          <LinkedInIcon />
        </a>
        {/* Sin correo configurado (CONTACT_EMAIL vacío) el botón no hace nada. */}
        {mail ? (
          <a
            className="contact-option"
            href={mail}
            aria-label={t('contact.email')}
            title={t('contact.email')}
          >
            <MailIcon />
          </a>
        ) : (
          <button
            className="contact-option"
            type="button"
            aria-label={t('contact.email')}
            title={t('contact.email')}
          >
            <MailIcon />
          </button>
        )}
      </div>
    </div>
  );
}
