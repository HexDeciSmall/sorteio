# Sorteio

Um clube de anime com três roletas editáveis: **amigo → carta especial → anime da semana**. Site estático em português, pronto para GitHub Pages, sem instalação, conta no site, servidor próprio ou etapa de compilação.

## Testar no computador

Extraia todos os arquivos para a mesma pasta e abra `index.html` em um navegador atualizado. Mantenha `styles.css`, `core.js`, `catalog.js`, `app.js`, `guessr-core.js`, `daily-core.js`, `daily-data.json`, `daily-cap.json`, `guessr.js`, `poster-placeholder.svg` e `favicon.svg` junto dele. Não é necessário instalar Node.js ou outras ferramentas. As roletas e a edição manual funcionam sem consultas externas; busca, capas remotas, notas pessoais e carregamento das pistas do Guessr Livre precisam de internet.

Para usar o **Desafio diário**, abra o site no GitHub Pages ou em uma prévia local servida por HTTP: abrir `index.html` diretamente como `file://` pode bloquear a leitura de `daily-data.json` e `daily-cap.json`. As roletas e o modo Livre continuam disponíveis no arquivo local, com internet para as consultas do Livre.

## Usar com o grupo

1. Abra **Editar listas**, no ícone de edição do topo, ou **Editar** em uma das roletas.
2. Na aba **Nomes**, adicione, edite ou remova os participantes. Se quiser consultar notas pessoais e jogar Guessr, informe também o link do perfil público de cada amigo no AniList. Hex já começa vinculado a [HexDSmall](https://anilist.co/user/HexDSmall/), Cap a [CapKiyo](https://anilist.co/user/CapKiyo/), Turbo a [Turbomob](https://anilist.co/user/Turbomob/), Mary a [Katupiry](https://anilist.co/user/Katupiry/), Kris a [KrismonKalamity](https://anilist.co/user/KrismonKalamity/) e Kyoka a [Kycks](https://anilist.co/user/Kycks/); faltam os perfis de KV e Nando. Kyoka é adicionado uma única vez aos dados salvos, se ainda não estiver na lista e houver espaço. Cada novo vínculo padrão é preenchido nos dados já salvos uma única vez, quando estiver vazio, preservando os perfis personalizados.
3. Na aba **Cartas**, edite os nomes, as descrições e o seletor **Efeito automático**. Use **Cartas padrão** para completar as cartas originais que faltarem, sem duplicar as que já estão cadastradas.
4. Na aba **Animes**, busque um título no catálogo ou cadastre-o manualmente. Selecione o resultado desejado, escolha quem indicou e finalize em **Adicionar** ou **Salvar alteração**, ao editar. Cada amigo pode ter até **2 indicações**; também é possível cadastrar títulos sem indicação.
5. Clique em **Girar tudo** para girar as três roletas na sequência. Se a carta pedir uma escolha, selecione a opção e use **Aplicar** ou **Não usar** antes do giro do anime. Também é possível usar os botões **Girar** de **Nomes**, **Cartas** e **Animes** individualmente.
6. Confira o anime sorteado. Com as três escolhas completas, clique em **Confirmar**, abaixo da roleta de animes, para registrar a rodada em **Resultados**. Só então o nome e o anime saem das opções disponíveis do ciclo.
7. Se quiser outro anime, clique em **Não, girar outro**. O nome e a carta permanecem, e apenas o anime é sorteado novamente. Confira a nova escolha antes de confirmar.
8. Depois de confirmar, clique em **Girar tudo** para sortear o próximo colega. Consulte as rodadas anteriores em **Histórico**, no ícone de relógio do topo.

Antes de completar as três escolhas, você pode refazer um giro individual. Com as três prontas, os giros de nomes e cartas ficam bloqueados enquanto você decide se confirma o anime ou pede outro. As escolhas pendentes continuam no mesmo estado ao fechar e reabrir o site; reabrir não confirma a rodada.

Use o ícone de setas cruzadas (**Embaralhar / Shuffle**), ao lado de Editar nas três roletas — Nomes, Cartas e Animes —, para mudar a ordem das opções disponíveis. O botão fica disponível quando há pelo menos duas opções e nenhuma roleta está girando. Embaralhar não sorteia outra opção nem altera as escolhas pendentes, os perfis, as indicações, os efeitos da vez ou os resultados. As quatro cópias de Sem Efeito continuam separadas e com a mesma chance. A nova ordem fica salva neste navegador e no backup das roletas.

Para esvaziar a lista de animes de uma vez, abra **Editar animes → Limpar todos** e confirme em **Limpar animes**. Todos os animes cadastrados serão removidos, inclusive os que já saíram, e a escolha de anime ainda não confirmada será descartada. Os nomes, cartas, resultados e histórico continuam guardados; os animes apagados não voltam ao limpar resultados. Exporte os dados antes se quiser restaurar a lista depois.

Recusar um anime não o consome. Se houver outra opção disponível, o título recusado fica fora do giro imediatamente seguinte, mas pode aparecer em rodadas futuras. Se só houver um anime disponível, adicione outro ou use **Girar** para sortear novamente o único título.

Os Resultados mostram as atribuições do ciclo atual na ordem em que aconteceram, no formato **Nome — Anime (efeito da carta)**. Quando a carta não tiver descrição, aparece o nome dela entre parênteses. Use **Copiar**, na seção Resultados, para levar essa lista ao grupo.

Os participantes iniciais são **Hex, KV, Cap, Nando, Turbo, Mary, Kris e Kyoka**. O site começa com **7 segmentos de cartas e nenhum anime**. Adicione os animes do grupo antes de completar um sorteio.

A atualização instala as cartas padrão uma única vez quando encontra uma lista vazia. As listas já personalizadas são mantidas; nelas, use **Cartas padrão** se quiser acrescentar as regras originais. Os antigos animes de exemplo são removidos quando o conjunto ainda está intacto, preservando as personalizações.

### Cartas e efeitos automáticos

O baralho padrão tem três cartas especiais e quatro cópias de Sem Efeito. Cada segmento tem a mesma chance: **Sem Efeito ocupa 4 dos 7 segmentos**. Você pode editar as cartas e escolher seu comportamento em **Efeito automático**; o nome ou a descrição, sozinhos, não ativam uma regra.

| Carta padrão | O que acontece |
| --- | --- |
| **Nem a Pau** | Escolha um anime para ficar fora da roleta apenas na vez atual. Use Aplicar para confirmar a escolha ou Não usar para continuar sem a exclusão. |
| **Preconceito** | Escolha um colega. As indicações dele ficam fora da roleta apenas na vez atual; os animes continuam cadastrados. Use Aplicar ou Não usar. |
| **Sem Efeito** | Não altera o sorteio. Há quatro cópias no baralho padrão. |
| **Infernizar** | Ao confirmar o anime da rodada, acrescenta **Hand Shakers, Gamers, Rent a Girlfriend e Terra Formars** à lista de animes, sem duplicar os títulos já cadastrados. |

Nem a Pau e Preconceito são filtros temporários. O site não permite aplicá-los quando isso deixaria a roleta sem animes; use Não usar para continuar nesse caso. A escolha feita para a vez permanece nas recusas do anime, ao recarregar a página e nos backups. Quando a rodada é confirmada, o filtro é encerrado.

Infernizar é obrigatório quando essa carta é confirmada: não exige Aplicar e não oferece Não usar. **Recusar um anime não acrescenta os quatro títulos**; a adição só acontece depois de Confirmar. As cartas personalizadas sem efeito automático apenas registram a descrição, para o grupo aplicar suas próprias regras manualmente.

### Busca, capas e notas

A busca de animes mostra **nome, capa e nota média do MyAnimeList (MAL)** quando esses dados estiverem disponíveis. Escolha a edição correta do anime antes de cadastrar, especialmente no caso de filmes, temporadas e continuações. O cadastro manual continua disponível sem vínculo com o catálogo.

A capa, o identificador do MAL e a nota média são guardados com o cadastro. A nota MAL representa o valor recebido na busca e não é atualizada automaticamente. Títulos manuais ou dados sem capa/nota exibem uma indicação de ausência, sem inventar valores.

Para notas pessoais, edite cada participante em **Nomes** e informe seu perfil, por exemplo `https://anilist.co/user/SEU-USUARIO/`. Ao sortear um anime do catálogo, a seção **Notas dos colegas**, abaixo das roletas, aparece automaticamente com **todos os nomes cadastrados**. Ela consulta a lista pública de cada colega com perfil vinculado e mostra sua nota na escala **0 a 10**, junto do status informado no AniList, como Assistindo ou Concluído. A consulta também funciona quando você gira apenas a roleta de animes, sem ter sorteado um nome. A nota pessoal é diferente da média MAL.

Colegas sem vínculo exibem **Sem perfil**. Você não precisa abrir uma seção nem selecionar um colega para carregar as notas; em caso de falha, use **Tentar notas novamente**. As notas pessoais são consultadas online, com cache curto de até 5 minutos durante a sessão, e não são uma cópia permanente no backup.

**Sem nota**, **não consta na lista pública** e **perfil/lista indisponível ou privado** são situações diferentes. O site não trata ausência de informação como prova de que alguém não assistiu. Sem perfil cadastrado, sem vínculo do anime com o catálogo ou durante uma falha do serviço, você ainda pode confirmar ou recusar o sorteio normalmente.

### Repetições e ciclos

Nomes e animes **não se repetem no mesmo ciclo**. Assim que uma rodada é confirmada, ambos deixam de participar dos próximos sorteios. As cartas podem se repetir. Giros ainda não confirmados não consomem as opções.

Os itens sorteados continuam cadastrados nas listas de edição; eles não são apagados. Quando quiser começar outro ciclo, clique em **Limpar resultados**, no cabeçalho da seção Resultados, e confirme. Os nomes e animes voltam às roletas, os Resultados do ciclo atual são limpos, e o Histórico permanece guardado. Escolhas pendentes ainda não confirmadas também são descartadas.

Para corrigir uma atribuição, use a lixeira **Excluir resultado** na linha correspondente e confirme. Ela é removida dos Resultados e do Histórico; o nome e o anime voltam a participar se ainda estiverem cadastrados. As outras atribuições continuam guardadas.

Se a atribuição excluída adicionou títulos por Infernizar, essas adições também são desfeitas quando continuam intactas e ainda não foram usadas. Títulos editados, já usados, escolhidos na rodada pendente ou presentes em outro resultado do Histórico são preservados.

O botão de som no topo ativa ou desativa os efeitos sonoros.

## Guessr

A aba **Guessr** é um jogo para descobrir de qual colega são as avaliações de três animes. Cada rodada usa **3 pistas reais**, com anime, nota e status vindos da lista pública do AniList. Escolha um dos nomes do grupo como palpite. O nome e o link do perfil de origem são revelados ao terminar a rodada, para conferir os dados.

Você tem **3 tentativas por rodada**. Acertar na primeira vale **3 pontos**, na segunda **2 pontos** e na terceira **1 ponto**. Um palpite errado não pode ser repetido na mesma rodada.

Escolha entre **Livre**, com novas rodadas a partir dos perfis vinculados, e **Desafio diário**, com cinco rodadas fixas para cada data.

### Livre

Para uma rodada valer pontos, é necessário ter **pelo menos 2 colegas com perfis aptos**: cada perfil precisa estar público, acessível e ter ao menos **3 animes avaliados**. Cadastrar um link, sozinho, não garante que ele tenha dados suficientes para jogar.

Hex, Cap, Turbo, Mary, Kris e Kyoka já vêm com seus perfis configurados. Cap usa [CapKiyo](https://anilist.co/user/CapKiyo/) tanto nas notas pessoais das roletas quanto no Livre. Quando pelo menos dois estiverem aptos, as rodadas valem pontos. Se apenas um perfil puder ser usado, o site oferece uma **Prévia jogável, sem pontuação**, usando três avaliações reais dele. Para incluir KV e Nando, abra **Editar listas → Nomes** e adicione seus links públicos corretos do AniList; esses dois perfis não são inventados nem preenchidos automaticamente.

O Guessr consulta apenas informações públicas. Entradas privadas, sem nota ou marcadas como conteúdo adulto não são usadas nas pistas; não há notas ou pistas inventadas. As capas vêm do AniList quando disponíveis. Perfis sem avaliações públicas suficientes não entram como origem de uma rodada.

As listas consultadas ficam em cache temporário na memória da sessão por **5 minutos**, limitado a **20 perfis**, para evitar consultas repetidas. Mudanças no AniList podem levar esse intervalo para aparecer. Não é necessário entrar no AniList pelo site nem fornecer senha ou chave de API.

O jogo e o placar do Livre são **locais ao navegador**. Os dados necessários para continuar a rodada, as tentativas e as estatísticas são salvos na chave local `sorteio.guessr.v1`, separada dos dados das roletas; as listas completas consultadas não são gravadas nesse salvamento. Não há banco de dados online, partida compartilhada nem sincronização de pontuação entre os colegas. Jogar Guessr não consome os nomes ou animes das roletas.

### Desafio diário

Cada data tem **5 rodadas fixas**, iguais para todos os navegadores que usam esta versão do site. Cada rodada oferece três tentativas e vale 3, 2 ou 1 ponto conforme o acerto: o máximo por dia é **15 pontos**. Termine as cinco rodadas para concluir o desafio; **concluir também conta para a sequência de participação quando houver erros**.

O calendário começa em **20/10/2026** e permite escolher datas até hoje, sempre pelo fuso **America/Sao_Paulo**. Não há desafios futuros. Você pode recuperar dias anteriores para fechar lacunas na sequência. A sequência atual conta dias concluídos consecutivos e permanece ativa quando o último dia concluído é hoje ou ontem. Um desafio concluído não pode ser reiniciado nem jogado novamente; as cinco rodadas continuam disponíveis para revisão.

As pistas vêm de bases públicas fixas. A edição de **20/10/2026**, identificada por `2026-10-20-v1`, mantém os cinco perfis originais de Hex, Turbo, Mary, Kris e Kyoka em `daily-data.json`. A partir de **21/10/2026**, a edição `2026-10-21-cap-v1` acrescenta o perfil real de **Cap — CapKiyo**, guardado em `daily-cap.json`, e passa a usar seis perfis. O desafio de 20/10 continua exatamente o mesmo.

O registro de edições em `guessr.js` escolhe a base pela data do desafio. **Mantenha os dois arquivos de dados e seus identificadores inalterados**; futuras edições precisam preservar as bases anteriores para não mudar desafios já disponíveis. As pistas do Diário não atualizam ao vivo nem dependem das listas locais. O Livre continua consultando os perfis atuais normalmente.

O progresso, a pontuação diária e a sequência ficam somente neste navegador, na chave `sorteio.guessr.daily.v1`. Os dias já salvos são preservados ao mudar de edição, incluindo conclusões e sequência. Não entram na exportação JSON das roletas e não são sincronizados online. Os arquivos `daily-core.js`, `daily-data.json` e `daily-cap.json` são obrigatórios para o Diário.

## Dados, backup e compartilhamento

As listas, configurações, ciclo e histórico são salvos automaticamente **somente no navegador e dispositivo usados**. O site não usa um banco de dados compartilhado, login ou sincronização entre amigos. Abrir o mesmo link em outro navegador começa com os dados iniciais. Limpar os dados do navegador pode apagar suas alterações.

- **Exportar dados**, em Editar listas, baixa um arquivo JSON **somente das Roletas**: listas, perfis AniList vinculados, dados do catálogo salvos nos animes, configurações, estado e resultados do ciclo e histórico. O arquivo não inclui o progresso nem o placar do Guessr Livre ou do Desafio diário.
- **Importar dados** carrega um backup e substitui os dados atuais após confirmação. Exporte antes se quiser guardar a versão anterior.
- **Copiar**, na seção Resultados abaixo das roletas, copia apenas as atribuições do ciclo atual, no mesmo formato exibido na lista.
- **Copiar**, no Histórico, copia as rodadas guardadas de todos os ciclos.

**Limpar**, no Histórico, apaga o histórico e os Resultados do ciclo atual após confirmação. Nomes e animes já sorteados continuam fora das roletas até você usar Limpar resultados para começar outro ciclo.

Backups anteriores da versão 1 continuam compatíveis com a importação. Os Resultados do ciclo atual também são preservados ao fechar e reabrir o site no mesmo navegador.

Para continuar as Roletas em outro computador, envie o JSON exportado e importe-o lá. Dados salvos ao abrir o arquivo localmente não são transferidos automaticamente para a versão publicada: exporte e importe para fazer essa mudança. O progresso do Guessr permanece no navegador onde foi jogado.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub. Um repositório público é a opção compatível com o plano gratuito.
2. Envie **o conteúdo desta pasta para a raiz do repositório**, incluindo o arquivo oculto `.nojekyll`. O `index.html` deve ficar na raiz, e não dentro de uma pasta `otaku-roll`.
3. Em **Settings → Pages**, escolha **Deploy from a branch** em Source.
4. Selecione a branch **main**, a pasta **/(root)** e clique em **Save**. Se sua branch tiver outro nome, selecione aquela que contém os arquivos.
5. Aguarde a publicação e use o endereço exibido pelo GitHub em Pages.

O formato habitual para um repositório de projeto é `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. Isso é um modelo de endereço; substitua pelos dados reais da sua conta e repositório.

Este pacote já inclui `.nojekyll` para servir os arquivos estáticos diretamente. Consulte a [configuração oficial do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) e a [documentação sobre arquivos estáticos e `.nojekyll`](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Serviços de catálogo

O catálogo MAL usa a API pública do **Tenrai**, com base fixa `https://api.tenrai.org/v1`, e as notas pessoais usam a API pública do **AniList**. As consultas saem diretamente do navegador, sem servidor próprio, chaves ou login no site. Os serviços podem ter limites ou indisponibilidade temporária; o cadastro manual e o sorteio continuam disponíveis.

O Tenrai substitui a API pública do Jikan, encerrada em **1º de outubro de 2026**. O [aviso do mantenedor do Jikan](https://github.com/jikan-me/jikan-rest/issues/613) indica o Tenrai como alternativa, e a [documentação do Tenrai](https://tenrai.org/) informa compatibilidade de esquema com Jikan v4.

## Personalização do código

- `index.html`: conteúdo e estrutura das telas.
- `styles.css`: cores, layout e aparência das roletas.
- `app.js`: interações, animações, edição e armazenamento no navegador.
- `core.js`: sorteio, validação de backups e dados iniciais.
- `catalog.js`: busca no catálogo MAL e consulta de notas públicas do AniList.
- `guessr-core.js`: seleção das pistas, tentativas, pontuação e validação do jogo salvo.
- `daily-core.js`: desafios por data, conclusão, calendário e sequência de participação do Diário.
- `daily-data.json`: base pública fixa `2026-10-20-v1`; deve ser preservada para manter os desafios anteriores.
- `daily-cap.json`: complemento fixo de CapKiyo, usado na edição `2026-10-21-cap-v1`; também deve ser preservado.
- `guessr.js`: telas dos modos Livre e Diário, registro das edições por data, consultas e armazenamento separado do Guessr.
- `poster-placeholder.svg`: imagem usada quando a capa do anime não está disponível.
- `favicon.svg`: ícone da aba do navegador.

Alterar os dados iniciais em `core.js` afeta novas sessões sem dados salvos. Para mudar as listas do navegador atual, use Editar listas. Depois de alterar os arquivos, envie-os novamente à mesma branch para atualizar o site.
