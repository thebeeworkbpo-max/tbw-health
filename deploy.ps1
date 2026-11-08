# Publica a plataforma TBW Health: envia as alterações para o GitHub e a Vercel faz o deploy sozinha.
# Uso:  powershell -ExecutionPolicy Bypass -File .\deploy.ps1 "descrição da alteração"
param([string]$mensagem = "Atualização da plataforma")
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
git pull --rebase origin main
git add -A
$pendente = git status --porcelain
if ($pendente) { git commit -m $mensagem } else { Write-Host "Nada novo para enviar." }
git push origin main
Write-Host "Enviado. Acompanhe o deploy em https://vercel.com (projeto tbw-health)."
