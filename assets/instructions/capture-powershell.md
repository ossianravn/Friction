```powershell
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8NoBom
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom

@'
<what you were doing -> what happened and what it cost -> workaround or suspected prevention -> solution if obvious -> anything else relevant>
'@ | friction add --stdin --source {{SOURCE}}
```
