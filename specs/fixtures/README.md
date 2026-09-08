# Fixtures

Files the specs upload. Reach them through `FIXTURES` in `specs/support/env.ts`, never by a hand-written
relative path — `setInputFiles` resolves relative paths against the process working directory.

| File | Used by | Notes |
| --- | --- | --- |
| `travel-photo.jpg` | `add-offer`, profile photo editor | 800×600, ~25 kB, generated — no stock photo, no licence question |

`travel-photo.jpg` is drawn by a script rather than downloaded, so it can be regenerated at any size:

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(800, 600)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::SteelBlue)
$g.DrawString('EW TravelApp - test upload', (New-Object System.Drawing.Font('Segoe UI', 22)), [System.Drawing.Brushes]::White, 40, 40)
$g.Dispose()
$bmp.Save("$PWD\travel-photo.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()
```

Both uploaders are `ng2-file-upload` with `allowedFileType: ['image']` and `maxFileSize: 10 MB`, so any
real image under that size works. Uploads go to Cloudinary, which is why the specs that use this file must
delete what they create.
