/**
 * MRitmo's account emails, in Spanish and in the app's style: white page,
 * black ink, one pill button, and the 6-digit code for when the link opens
 * in the wrong place. The "Servidor" workflow uploads these to Supabase Auth.
 *
 * Supabase fills in {{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }} and
 * {{ .NewEmail }} when it sends each one.
 */

const FONT = "Inter, -apple-system, 'SF Pro Text', Roboto, 'Helvetica Neue', Arial, sans-serif";

function layout({ preheader, title, intro, button, codeLabel = 'O escribe este código en la app', note }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr>
    <td align="center" style="padding:48px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;font-family:${FONT};color:#0A0A0B;">
        <tr>
          <td style="font-size:15px;font-weight:600;letter-spacing:-0.1px;padding-bottom:40px;">MRitmo</td>
        </tr>
        <tr>
          <td style="font-size:30px;line-height:36px;font-weight:700;letter-spacing:-0.9px;padding-bottom:12px;">${title}</td>
        </tr>
        <tr>
          <td style="font-size:16px;line-height:24px;color:#6C6C72;letter-spacing:-0.1px;padding-bottom:32px;">${intro}</td>
        </tr>
        ${
          button
            ? `<tr>
          <td style="padding-bottom:32px;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0A0A0B;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;letter-spacing:-0.2px;padding:15px 28px;border-radius:999px;">${button}</a>
          </td>
        </tr>`
            : ''
        }
        <tr>
          <td style="background:#F4F4F6;border-radius:16px;padding:20px 22px;">
            <div style="font-size:13px;line-height:18px;color:#6C6C72;padding-bottom:6px;">${codeLabel}</div>
            <div style="font-size:30px;line-height:36px;font-weight:600;letter-spacing:6px;font-variant-numeric:tabular-nums;">{{ .Token }}</div>
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;line-height:19px;color:#A1A1A8;padding-top:32px;">${note}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const IGNORE = 'Si no fuiste tú, ignora este correo: nada cambia en tu cuenta.';
const OPEN_ON_PHONE = 'Abre el enlace desde el teléfono donde tienes MRitmo. Vence en 1 hora.';

export const emails = {
  confirmation: {
    subject: 'Activa tu cuenta de MRitmo',
    content: layout({
      preheader: 'Un toque y tu cuenta queda lista.',
      title: 'Activa tu cuenta',
      intro: 'Con tu cuenta, tus tareas, hábitos y ajustes quedan respaldados, y puedes avanzar con tus amigos.',
      button: 'Activar cuenta',
      note: `${OPEN_ON_PHONE} ${IGNORE}`,
    }),
  },
  magic_link: {
    subject: 'Entra a MRitmo',
    content: layout({
      preheader: 'Tu enlace para entrar sin contraseña.',
      title: 'Entra sin contraseña',
      intro: 'Toca el botón y entras directo a tu cuenta.',
      button: 'Entrar a MRitmo',
      note: `${OPEN_ON_PHONE} ${IGNORE}`,
    }),
  },
  recovery: {
    subject: 'Cambia tu contraseña de MRitmo',
    content: layout({
      preheader: 'Elige una contraseña nueva.',
      title: 'Cambia tu contraseña',
      intro: 'Toca el botón para elegir una contraseña nueva. Tus datos siguen intactos.',
      button: 'Elegir contraseña nueva',
      note: `${OPEN_ON_PHONE} ${IGNORE}`,
    }),
  },
  email_change: {
    subject: 'Confirma tu nuevo correo en MRitmo',
    content: layout({
      preheader: 'Confirma el cambio de correo.',
      title: 'Confirma tu nuevo correo',
      intro: 'Pediste usar {{ .NewEmail }} en tu cuenta de MRitmo. Confírmalo para terminar el cambio.',
      button: 'Confirmar correo',
      note: IGNORE,
    }),
  },
  invite: {
    subject: 'Te invitaron a MRitmo',
    content: layout({
      preheader: 'Crea tu cuenta de MRitmo.',
      title: 'Te invitaron a MRitmo',
      intro: 'MRitmo mide tu día en tiempo, no en número de tareas. Acepta la invitación para crear tu cuenta.',
      button: 'Aceptar invitación',
      note: IGNORE,
    }),
  },
  reauthentication: {
    subject: 'Tu código de MRitmo',
    content: layout({
      preheader: 'Confirma que eres tú.',
      title: 'Confirma que eres tú',
      intro: 'Escribe este código en la app para continuar.',
      button: null,
      codeLabel: 'Código',
      note: `Vence en 1 hora. ${IGNORE}`,
    }),
  },
};
