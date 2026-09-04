# Guia de Integração - Módulo de Inventário Florestal

## Visão Geral

Este guia explica como integrar o módulo de Inventário Florestal em um aplicativo Flutter existente.

---

## Passo 1: Copiar os arquivos

Copie a pasta `lib/` do ZIP para dentro do seu projeto, na mesma raiz onde já existe sua pasta `lib/`.

A estrutura deve ficar assim:

```
seu_projeto/
├── lib/
│   ├── main.dart              ← seu main.dart (já existe)
│   ├── models/                ← COPIAR do ZIP
│   │   ├── parcela.dart
│   │   ├── parcela.g.dart
│   │   ├── individuo.dart
│   │   ├── individuo.g.dart
│   │   ├── fuste.dart
│   │   ├── fuste.g.dart
│   │   ├── caracterizacao.dart
│   │   ├── caracterizacao.g.dart
│   │   ├── censo_sub_parcela.dart
│   │   └── censo_sub_parcela.g.dart
│   ├── database/              ← COPIAR do ZIP
│   │   └── database_helper.dart
│   └── screens/               ← COPIAR do ZIP
│       ├── home_screen.dart
│       ├── parcela_form_screen.dart
│       ├── individuos_list_screen.dart
│       ├── individuos_spreadsheet_screen.dart
│       ├── individuo_form_screen.dart
│       ├── export_screen.dart
│       ├── caracterizacao_screen.dart
│       ├── censo_sub_parcelas_list_screen.dart
│       └── censo_sub_parcela_form_screen.dart
```

**IMPORTANTE:** Não substitua o seu `main.dart`! O dele é diferente.

---

## Passo 2: Adicionar dependências

Abra o arquivo `pubspec.yaml` do seu projeto e adicione essas dependências:

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  intl: ^0.20.3
  uuid: ^4.5.1
  image_picker: ^1.1.2
  web: ^1.1.1
```

Se você já tiver alguma dessas dependências, verifique se a versão é compatível.

Depois rode:
```bash
flutter pub get
```

---

## Passo 3: Inicializar o Hive no seu main.dart

Abra seu `main.dart` e adicione a inicialização do Hive ANTES do `runApp()`:

```dart
import 'package:hive_flutter/hive_flutter.dart';
import 'package:inventario_florestal/database/database_helper.dart';
import 'package:inventario_florestal/models/parcela.dart';
import 'package:inventario_florestal/models/individuo.dart';
import 'package:inventario_florestal/models/fuste.dart';
import 'package:inventario_florestal/models/caracterizacao.dart';
import 'package:inventario_florestal/models/censo_sub_parcela.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // ADICIONAR ESTAS LINHAS:
  await Hive.initFlutter();
  Hive.registerAdapter(ParcelaAdapter());
  Hive.registerAdapter(IndividuoAdapter());
  Hive.registerAdapter(FusteAdapter());
  Hive.registerAdapter(CaracterizacaoAdapter());
  Hive.registerAdapter(CensoSubParcelaAdapter());
  
  runApp(const MeuApp());
}
```

**NOTA:** Se você já usa Hive no seu projeto, pode pular a inicialização. Mas certifique-se de que os adapters estão registrados.

---

## Passo 4: Configurar o locale (idioma)

Para que as datas apareçam em português, adicione o `localizationsDelegates` no seu `MaterialApp`:

```dart
MaterialApp(
  localizationsDelegates: const [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: const [
    Locale('pt', 'BR'),
  ],
  locale: const Locale('pt', 'BR'),
  // ... resto do seu MaterialApp
)
```

---

## Passo 5: Navegar para o módulo de inventário

No lugar que você quiser acessar o inventário, adicione uma navegação:

```dart
import 'package:inventario_florestal/screens/home_screen.dart';

// Dentro de um botão, menu, etc:
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => const HomeScreen(),
  ),
);
```

---

## Passo 6: Adicionar pacotes de idioma (opcional mas recomendado)

Para que o date picker funcione em português, adicione no `pubspec.yaml`:

```yaml
dependencies:
  flutter_localizations:
    sdk: flutter
```

---

## Estrutura de pastas do módulo

| Pasta | O que contém |
|-------|-------------|
| `models/` | Models de dados (Parcela, Individuo, Fuste, etc.) |
| `models/*.g.dart` | Adaptadores Hive gerados automaticamente |
| `database/` | DatabaseHelper - camada de CRUD com Hive |
| `screens/` | Todas as telas do módulo |

---

## Troubleshooting (Problemas comuns)

### "TypeAdapter not registered"
Ocorre quando esqueceu de registrar um adapter. Certifique-se de que todos os 5 adapters estão no `main.dart`:
```dart
Hive.registerAdapter(ParcelaAdapter());
Hive.registerAdapter(IndividuoAdapter());
Hive.registerAdapter(FusteAdapter());
Hive.registerAdapter(CaracterizacaoAdapter());
Hive.registerAdapter(CensoSubParcelaAdapter());
```

### "Could not find package 'hive_flutter'"
Rode `flutter pub get` novamente.

### Tela fica em branco
Verifique se o Hive foi inicializado com `await Hive.initFlutter();` antes do `runApp()`.

### Datas em inglês
Certifique-se de que `flutter_localizations` está nas dependências e que o `MaterialApp` tem os `localizationsDelegates`.

---

## Lista de arquivos incluídos

- `lib/models/parcela.dart` + `.g.dart`
- `lib/models/individuo.dart` + `.g.dart`
- `lib/models/fuste.dart` + `.g.dart`
- `lib/models/caracterizacao.dart` + `.g.dart`
- `lib/models/censo_sub_parcela.dart` + `.g.dart`
- `lib/database/database_helper.dart`
- `lib/screens/home_screen.dart`
- `lib/screens/parcela_form_screen.dart`
- `lib/screens/individuos_list_screen.dart`
- `lib/screens/individuos_spreadsheet_screen.dart`
- `lib/screens/individuo_form_screen.dart`
- `lib/screens/export_screen.dart`
- `lib/screens/caracterizacao_screen.dart`
- `lib/screens/censo_sub_parcelas_list_screen.dart`
- `lib/screens/censo_sub_parcela_form_screen.dart`

---

## Contato

Em caso de dúvidas, entre em contato com Feliphe Rossi.
