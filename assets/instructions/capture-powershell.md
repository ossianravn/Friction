```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8NoBom
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
"<what you were doing -> what got in the way -> likely prevention>" |
  friction add --stdin --source {{SOURCE}}
```
