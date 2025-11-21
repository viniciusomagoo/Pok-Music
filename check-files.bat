@echo off
chcp 65001 >nul
color 0E

echo =======================================
echo   Verificador de Arquivos do Projeto
echo =======================================
echo.

set MISSING=0

echo Verificando arquivos necessarios...
echo.

REM Arquivos essenciais
if exist package.json (
    echo [OK] package.json
) else (
    echo [FALTA] package.json
    set MISSING=1
)

if exist tsconfig.json (
    echo [OK] tsconfig.json
) else (
    echo [FALTA] tsconfig.json
    set MISSING=1
)

if exist bot.ts (
    echo [OK] bot.ts
) else (
    echo [FALTA] bot.ts
    set MISSING=1
)

if exist register-commands.ts (
    echo [OK] register-commands.ts
) else (
    echo [FALTA] register-commands.ts
    set MISSING=1
)

if exist config.json (
    echo [OK] config.json
) else (
    echo [FALTA] config.json
    set MISSING=1
)

echo.
echo Verificando diretorios...
echo.

if exist node_modules (
    echo [OK] node_modules (dependencias instaladas)
) else (
    echo [FALTA] node_modules (execute: npm install)
    set MISSING=1
)

if exist dist (
    echo [OK] dist (projeto compilado)
    if exist dist\bot.js (
        echo [OK] dist\bot.js
    ) else (
        echo [FALTA] dist\bot.js
        set MISSING=1
    )
) else (
    echo [FALTA] dist (execute: npm run build)
    set MISSING=1
)

echo.
echo =======================================
echo.

if %MISSING%==1 (
    echo STATUS: ARQUIVOS FALTANDO!
    echo.
    echo O que fazer:
    echo.
    echo 1. Se faltam arquivos .ts ou .json:
    echo    - Baixe todos os arquivos do projeto
    echo    - Certifique-se de ter:
    echo      * package.json
    echo      * tsconfig.json
    echo      * bot.ts
    echo      * register-commands.ts
    echo      * config.json
    echo.
    echo 2. Se falta node_modules:
    echo    - Execute: npm install
    echo.
    echo 3. Se falta dist:
    echo    - Execute: npm run build
    echo.
    echo 4. Ou execute o instalador automatico:
    echo    - .\install.bat
    echo.
) else (
    echo STATUS: TODOS OS ARQUIVOS OK!
    echo.
    echo Proximos passos:
    echo 1. Configure config.json com seu token
    echo 2. Execute: npm run register-commands
    echo 3. Execute: npm start
    echo.
)

echo =======================================
pauses