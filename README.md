# 🌿 AGF Coleta

**Sistema de Coleta de Dados em Campo** - Desenvolvido para a Agroflor

---

## 📋 Sobre o Projeto

O **AGF Coleta** é um aplicativo web (PWA) para coleta de dados georreferenciados em campo. Funciona como o QField, mas com sincronização automática para o Box e atualização do WebMap.

### ✨ Funcionalidades

- 🗺️ **Mapa interativo** com imagem de satélite
- 📍 **Coleta georreferenciada** com GPS automático
- 📝 **Formulários customizáveis** por projeto
- 💾 **Funciona offline** (salva dados localmente)
- 🔄 **Sincronização automática** com Box
- 🌐 **Atualização em tempo real** do WebMap
- 📱 **Instalável** como app no celular

---

## 🚀 Como Usar

### 1. Instalar no Celular

1. Abra o navegador (Chrome ou Edge)
2. Acesse o link do app
3. Clique nos 3 pontos → "Instalar app" ou "Adicionar à tela inicial"
4. Pronto! O app aparece como um aplicativo normal

### 2. Login

- Use seu email corporativo e senha
- Após primeiro login, funciona offline

### 3. Escolher Projeto

- Na tela inicial, selecione o projeto
- Ex: "PAEBM - Água e Esgoto"

### 4. Coletar Dados

1. Toque no botão **"+ Coletar Ponto"**
2. O GPS pega a localização automaticamente
3. Preencha o formulário
4. Tire uma foto (opcional)
5. Toque em **"Salvar"**

### 5. Sincronizar

- No fim do dia, toque no botão **"🔄 Sync"**
- Os dados são enviados para o Box
- O WebMap é atualizado automaticamente

---

## 📁 Estrutura de Pastas

```
AGF_Coleta/
├── index.html          # Página principal
├── manifest.json       # Configuração PWA
├── sw.js              # Service Worker (offline)
├── css/
│   └── style.css      # Estilos do app
├── js/
│   ├── app.js         # Lógica principal
│   ├── map.js         # Funcionalidades do mapa
│   └── sync.js        # Sincronização com Box
├── img/
│   └── logo.jpg       # Logo da Agroflor
├── projetos/          # Configurações dos projetos
└── dados/             # Dados locais (backup)
```

---

## 🔧 Configuração

### Cores da Empresa

As cores estão configuradas no `css/style.css`:

```css
--verde-escuro: #0D4A35;    /* Cor principal */
--verde-medio: #1A6B4F;     /* Botões */
--verde-claro: #A8D5BA;     /* Destaques */
--branco: #FFFFFF;          /* Texto */
```

### Sincronização com Box

As credenciais do Box estão em `js/sync.js`:

```javascript
client_id: 'SEU_CLIENT_ID'
client_secret: 'SEU_CLIENT_SECRET'
```

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Uso |
|------------|-----|
| HTML5 | Estrutura |
| CSS3 | Estilos |
| JavaScript | Lógica |
| Leaflet.js | Mapas |
| Box API | Sincronização |
| PWA | Funcionalidade offline |

---

## 📱 Compatibilidade

- ✅ Android (Chrome, Edge)
- ✅ iOS (Safari)
- ✅ Desktop (Chrome, Firefox, Edge)

---

## 🔐 Segurança

- Credenciais do Box em arquivo `.env` (não versionado)
- Dados locais criptografados no localStorage
- Autenticação via OAuth 2.0

---

## 📈 Próximos Passos

- [ ] Adicionar projeto "Inventário Florestal"
- [ ] Adicionar projeto "Coleta de Fauna"
- [ ] Melhorar formulário de configuração
- [ ] Adicionar exportação de dados
- [ ] Implementar relatórios

---

## 🤝 Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido por:** Agroflor  
**Versão:** 1.0.0  
**Última atualização:** Julho 2026
