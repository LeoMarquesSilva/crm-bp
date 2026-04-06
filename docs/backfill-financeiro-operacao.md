# Backfill financeiro RD -> Sheets (execucao unica)

## Endpoint

- `POST /api/sync-financeiro-rd`
- Body:
  - `accessToken` (Google OAuth access token)
  - `spreadsheetId`
  - `sheetName` (opcional)
  - `dryRun` (opcional, default `true`)
  - `sampleDealIds` (opcional, ex.: `["68924d7526c1f50018dc039b"]`)

## Comando recomendado (dryRun)

```bash
curl --request POST \
  --url 'http://localhost:3001/api/sync-financeiro-rd' \
  --header 'content-type: application/json' \
  --data '{
    "accessToken":"<GOOGLE_ACCESS_TOKEN>",
    "spreadsheetId":"<SPREADSHEET_ID>",
    "sheetName":"<ABA>",
    "dryRun":true,
    "sampleDealIds":["68924d7526c1f50018dc039b"]
  }'
```

## Comando de execucao real (write)

```bash
curl --request POST \
  --url 'http://localhost:3001/api/sync-financeiro-rd' \
  --header 'content-type: application/json' \
  --data '{
    "accessToken":"<GOOGLE_ACCESS_TOKEN>",
    "spreadsheetId":"<SPREADSHEET_ID>",
    "sheetName":"<ABA>",
    "dryRun":false,
    "sampleDealIds":["68924d7526c1f50018dc039b"]
  }'
```

## Checklist operacional

- Confirmar `RD_CRM_TOKEN` valido no ambiente.
- Executar `dryRun=true` e salvar resposta JSON.
- Revisar `stats.updatesCount`, `stats.missingColumns` e `sampleDivergences`.
- Revisar `criticalDealValidation` para deals criticos.
- Executar `dryRun=false` somente apos aprovacao.
- Reexecutar com `dryRun=true` para confirmar queda de divergencias.

## Validacao local previa (amostra)

Script utilitario:

```bash
node scripts/audit-financeiro-rd-local.js
```

Ultima auditoria local (`public/CRM-DADOS.xlsx` vs RD):

- `rdDeals`: 640
- `rowsWithDeal`: 611
- `rowsMatched`: 600
- `rowsWithDiff`: 288
- Maior concentracao de divergencias: campos `rateio_porcentagem_*_financeiro` e `mensal_preco_fechado_financeiro`
- Deal critico `68924d7526c1f50018dc039b` com divergencias confirmadas em percentual de rateio (civel/trabalhista) e primeiro faturamento.
