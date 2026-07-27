# Supabase Auth email templates (GHL Video branded)

Paste each Subject and Body into Supabase, Authentication, Emails, Templates.
Email-safe HTML: table layout, inline styles, web-safe fonts, and a gradient
with a solid gold fallback for Outlook. Brand colors: canvas #08090D, card
#12141B, hair #242736, ink #EEF0F6, muted #9096A8, gold #FCC000, green #00CC00,
blue #0090FC. The two your login flow actually uses are Reset password and
Magic link. Do not change the `{{ .ConfirmationURL }}` / `{{ .Token }}` tokens.

Link templates (Reset password, Magic link, Confirm sign up, Invite, Change
email) share one shell; only Subject, heading, intro, and button label differ.
Reauthentication shows a code instead of a button.

--------------------------------------------------------------------------------
## 1. Reset password  (used by "set your password" and "forgot password")
Subject:
Set your GHL Video password

Body:
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08090d;margin:0;padding:0;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:480px;">
      <tr><td style="height:4px;background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="background-color:#12141b;border:1px solid #242736;border-top:0;border-radius:0 0 12px 12px;padding:36px 36px 30px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0 0 26px;font-size:16px;font-weight:bold;letter-spacing:1px;color:#eef0f6;">GHL <span style="color:#fcc000;">VIDEO</span></p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#eef0f6;font-weight:bold;">Set your password</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#9096a8;">We got a request to set or reset the password for your GHL Video portal. Choose a new one below. This link is single use and expires soon.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>
          <td style="background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#08090d;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;">Set my password &rarr;</a>
          </td>
        </tr></table>
        <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#5a6076;">If the button does not work, copy and paste this link:</p>
        <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0090fc;">{{ .ConfirmationURL }}</a></p>
      </td></tr>
      <tr><td style="padding:18px 36px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5a6076;">GHL Video, a brand of Vidiosa LLC. Questions? <a href="mailto:hi@ghlvideo.com" style="color:#9096a8;">hi@ghlvideo.com</a><br>If you did not request this, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>

--------------------------------------------------------------------------------
## 2. Magic link or OTP  (used by the "one-click sign-in link" fallback)
Subject:
Your GHL Video sign-in link

Body:
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08090d;margin:0;padding:0;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:480px;">
      <tr><td style="height:4px;background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="background-color:#12141b;border:1px solid #242736;border-top:0;border-radius:0 0 12px 12px;padding:36px 36px 30px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0 0 26px;font-size:16px;font-weight:bold;letter-spacing:1px;color:#eef0f6;">GHL <span style="color:#fcc000;">VIDEO</span></p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#eef0f6;font-weight:bold;">Sign in to your portal</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#9096a8;">Here is your one-click sign-in link for the GHL Video portal. It is single use and expires soon.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>
          <td style="background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#08090d;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;">Sign in &rarr;</a>
          </td>
        </tr></table>
        <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#5a6076;">If the button does not work, copy and paste this link:</p>
        <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0090fc;">{{ .ConfirmationURL }}</a></p>
      </td></tr>
      <tr><td style="padding:18px 36px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5a6076;">GHL Video, a brand of Vidiosa LLC. Questions? <a href="mailto:hi@ghlvideo.com" style="color:#9096a8;">hi@ghlvideo.com</a><br>If you did not request this, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>

--------------------------------------------------------------------------------
## 3. Confirm sign up
Subject:
Confirm your email for GHL Video

Body: (same shell; heading "Confirm your email", intro "Thanks for joining GHL Video. Confirm this email address to activate your account.", button "Confirm email")

--------------------------------------------------------------------------------
## 4. Invite user
Subject:
You are invited to GHL Video

Body: (same shell; heading "You are invited", intro "You have been invited to the GHL Video portal. Accept the invite to set up your account.", button "Accept invite")

--------------------------------------------------------------------------------
## 5. Change email address
Subject:
Confirm your new email for GHL Video

Body: (same shell; heading "Confirm your new email", intro "We got a request to change the email on your GHL Video account. Confirm this new address to complete the change.", button "Confirm new email")

--------------------------------------------------------------------------------
## 6. Reauthentication  (shows a code, not a link)
Subject:
Your GHL Video verification code

Body:
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08090d;margin:0;padding:0;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:480px;">
      <tr><td style="height:4px;background-color:#fcc000;background-image:linear-gradient(100deg,#fcc000,#00cc00);border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="background-color:#12141b;border:1px solid #242736;border-top:0;border-radius:0 0 12px 12px;padding:36px 36px 30px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0 0 26px;font-size:16px;font-weight:bold;letter-spacing:1px;color:#eef0f6;">GHL <span style="color:#fcc000;">VIDEO</span></p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#eef0f6;font-weight:bold;">Your verification code</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#9096a8;">Enter this code to confirm it is you.</p>
        <p style="margin:0 0 6px;font-size:30px;font-weight:bold;letter-spacing:6px;color:#fcc000;font-family:'Helvetica Neue',Arial,sans-serif;">{{ .Token }}</p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#5a6076;">This code expires soon. If you did not request it, ignore this email.</p>
      </td></tr>
      <tr><td style="padding:18px 36px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5a6076;">GHL Video, a brand of Vidiosa LLC. Questions? <a href="mailto:hi@ghlvideo.com" style="color:#9096a8;">hi@ghlvideo.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
