# Sorteio

Um clube de anime com três roletas editáveis: **amigo → carta especial → anime da semana**. A aba Guessr reúne **Livre**, **Notas diárias**, **Personagens** e **Anidle**. O site em português pode ser publicado no GitHub Pages. Os jogos têm progresso local; login, progresso entre dispositivos e rankings compartilhados usam **Firebase no plano gratuito Spark** quando configurado.

**Já usa o site com Firebase funcionando?** Siga `ATUALIZAR-NOVOS-DESAFIOS.md`, entregue com `atualizacao-guessr-diarios.zip`. Esse ZIP de atualização não inclui `firebase-config.js`: preserve o arquivo já publicado e atualize as regras do Firestore no mesmo projeto. Não precisa recriar contas ou configurar outro Firebase.

**Atualização das cartas especiais:** o guia `ATUALIZAR-CARTAS-ESPECIAIS.md` acompanha `atualizacao-cartas-especiais.zip`. Essa atualização das Roletas preserva a configuração do Firebase e os arquivos dos outros jogos.

**Perfil do Nando:** o guia `ATUALIZAR-PERFIL-NANDO.md` acompanha `atualizacao-perfil-nando.zip`, com o vínculo `nandolrv` e a edição de Notas diárias a partir de 24/10/2026. Publique também as regras do Firestore incluídas nesse pacote para salvar a nova edição online.

## Testar no computador

Extraia todos os arquivos para a mesma pasta e abra `index.html` em um navegador atualizado. Mantenha todos os arquivos entregues, incluindo `styles.css`, `core.js`, `catalog.js`, `app.js`, `guessr-core.js`, `daily-core.js`, `spark-core.js`, `daily-data.json`, `daily-cap.json`, `daily-kv.json`, `daily-nando.json`, `guessr.js`, `mini-core.js`, `mini-games.js`, `mini.css`, `mini-data.json`, `cloud-client.js`, `account.js`, `poster-placeholder.svg` e `favicon.svg`. O arquivo `firebase-config.js` pertence à configuração do seu site e precisa continuar ao lado de `index.html`. Não é necessário instalar Node.js, usar terminal ou contratar servidor. Para uma primeira instalação, o preparo do Firebase é explicado no guia `TUTORIAL-FIREBASE-GRATUITO.md`. As roletas e a edição manual funcionam sem consultas externas; busca, capas remotas, notas pessoais e carregamento das pistas do Guessr Livre precisam de internet.

Para usar **Notas diárias**, **Personagens** e **Anidle**, abra o site no GitHub Pages ou em uma prévia local servida por HTTP: abrir `index.html` diretamente como `file://` pode bloquear a leitura dos arquivos JSON. As roletas e o modo Livre continuam disponíveis no arquivo local, com internet para as consultas do Livre.

## Usar com o grupo

1. Abra **Editar listas**, no ícone de edição do topo, ou **Editar** em uma das roletas.
2. Na aba **Nomes**, adicione, edite ou remova os participantes. Se quiser consultar notas pessoais e jogar Guessr, informe também o link do perfil público de cada amigo no AniList. Hex já começa vinculado a [HexDSmall](https://anilist.co/user/HexDSmall/), KV a [knvcria](https://anilist.co/user/knvcria/), Cap a [CapKiyo](https://anilist.co/user/CapKiyo/), Nando a [nandolrv](https://anilist.co/user/nandolrv/), Turbo a [Turbomob](https://anilist.co/user/Turbomob/), Mary a [Katupiry](https://anilist.co/user/Katupiry/), Kris a [KrismonKalamity](https://anilist.co/user/KrismonKalamity/) e Kyoka a [Kycks](https://anilist.co/user/Kycks/). Kyoka é adicionado uma única vez aos dados salvos, se ainda não estiver na lista e houver espaço. Cada novo vínculo padrão é preenchido nos dados já salvos uma única vez, quando estiver vazio, preservando os perfis personalizados.
3. Na aba **Cartas**, edite os nomes, as descrições e o seletor **Efeito automático**. Use **Cartas padrão** para completar as cartas originais que faltarem, sem duplicar as que já estão cadastradas.
4. Na aba **Animes**, busque um título no catálogo ou cadastre-o manualmente. Selecione o resultado desejado, escolha quem indicou e finalize em **Adicionar** ou **Salvar alteração**, ao editar. Cada amigo pode ter até **2 indicações**; também é possível cadastrar títulos sem indicação.
5. Clique em **Girar tudo** para sortear o nome e a carta e seguir o fluxo indicado. Resolva as escolhas da carta quando aparecerem; algumas regras substituem o giro do anime por uma escolha direta. Também é possível usar os botões **Girar** de **Nomes**, **Cartas** e **Animes** individualmente quando disponíveis.
6. Confira a atribuição final e clique em **Confirmar**, abaixo da roleta de animes, para registrá-la em **Resultados**. Escolher ou aplicar um efeito deixa um rascunho: as alterações nos resultados e o consumo das opções só acontecem na confirmação.
7. Quando a carta permitir outro giro, use **Não, girar outro**. O nome e a carta permanecem, e apenas o anime é sorteado novamente. Confira a nova escolha antes de confirmar.
8. Depois de confirmar, clique em **Girar tudo** para sortear o próximo colega. Consulte as rodadas anteriores em **Histórico**, no ícone de relógio do topo.

Antes de completar as três escolhas, você pode refazer um giro individual. Com as três prontas, os giros de nomes e cartas ficam bloqueados enquanto você decide se confirma o anime ou pede outro. As escolhas pendentes continuam no mesmo estado ao fechar e reabrir o site; reabrir não confirma a rodada.

Use o ícone de setas cruzadas (**Embaralhar / Shuffle**), ao lado de Editar nas três roletas — Nomes, Cartas e Animes —, para mudar a ordem das opções disponíveis. O botão fica disponível quando há pelo menos duas opções e nenhuma roleta está girando. Embaralhar não sorteia outra opção nem altera as escolhas pendentes, os perfis, as indicações, os efeitos da vez ou os resultados. As quatro cópias de Sem Efeito continuam separadas e com a mesma chance. A nova ordem fica salva neste navegador e no backup das roletas.

Para esvaziar a lista de animes de uma vez, abra **Editar animes → Limpar todos** e confirme em **Limpar animes**. Todos os animes cadastrados serão removidos, inclusive os que já saíram, e a escolha de anime ainda não confirmada será descartada. Os nomes, cartas, resultados e histórico continuam guardados; os animes apagados não voltam ao limpar resultados. Exporte os dados antes se quiser restaurar a lista depois.

Recusar um anime não o consome. Se houver outra opção disponível, o título recusado fica fora do giro imediatamente seguinte, mas pode aparecer em rodadas futuras. Se só houver um anime disponível, adicione outro ou use **Girar** para sortear novamente o único título.

Os Resultados mostram as atribuições do ciclo atual na ordem em que aconteceram, no formato **Nome — Anime (efeito da carta)**. Quando a carta não tiver descrição, aparece o nome dela entre parênteses. Use **Copiar**, na seção Resultados, para levar essa lista ao grupo.

Os participantes iniciais são **Hex, KV, Cap, Nando, Turbo, Mary, Kris e Kyoka**. O site começa com **11 segmentos de cartas e nenhum anime**. Adicione os animes do grupo antes de completar um sorteio.

A atualização acrescenta **Sofra Imbecil, Destruição Mutua Assegurada, O Rei mandou e To fora dessa** uma única vez, preservando as cartas personalizadas. Use **Cartas padrão** para completar as cartas originais que faltarem. Os antigos animes de exemplo são removidos quando o conjunto ainda está intacto, preservando as personalizações.

### Cartas e efeitos automáticos

O baralho padrão tem sete cartas especiais e quatro cópias de Sem Efeito. Cada segmento tem a mesma chance: **Sem Efeito ocupa 4 dos 11 segmentos**. Você pode editar as cartas e escolher seu comportamento em **Efeito automático**; o nome ou a descrição, sozinhos, não ativam uma regra.

| Carta padrão | O que acontece |
| --- | --- |
| **Nem a Pau** | Escolha um anime para ficar fora da roleta apenas na vez atual. Use Aplicar para confirmar a escolha ou Não usar para continuar sem a exclusão. |
| **Preconceito** | Escolha um colega. As indicações dele ficam fora da roleta apenas na vez atual; os animes continuam cadastrados. Use Aplicar ou Não usar. |
| **Sem Efeito** | Não altera o sorteio. Há quatro cópias no baralho padrão. |
| **Infernizar** | Ao confirmar o anime da rodada, acrescenta **Hand Shakers, Gamers, Rent a Girlfriend e Terra Formars** à lista de animes, sem duplicar os títulos já cadastrados. |
| **Sofra Imbecil** | Depois do giro do anime, pode trocar a atribuição com um colega que já rodou ou manter o próprio resultado. A troca só é concluída em Confirmar. |
| **Destruição Mutua Assegurada** | Escolha outro colega, tenha ele rodado ou não. Os dois assistirão **Rent a Girlfriend em call**, sem giro de anime. Se o colega já tinha um anime, essa atribuição anterior é liberada. Vale mesmo se Rent a Girlfriend já saiu para outra pessoa e não cadastra cópias do título na lista. |
| **O Rei mandou** | Escolha um colega que ainda não rodou e um anime disponível na roleta para ele. O dono da carta continua o próprio sorteio normalmente. |
| **To fora dessa** | Informe manualmente um anime, filme ou OVA, dentro ou fora da roleta, para assistir sem girar. Um título externo não é acrescentado automaticamente ao catálogo. |

Nem a Pau e Preconceito são filtros temporários. O site não permite aplicá-los quando isso deixaria a roleta sem animes; use Não usar para continuar nesse caso. A escolha feita para a vez permanece nas recusas do anime, ao recarregar a página e nos backups. Quando a rodada é confirmada, o filtro é encerrado.

Infernizar é obrigatório quando essa carta é confirmada: não exige Aplicar e não oferece Não usar. **Recusar um anime não acrescenta os quatro títulos**; a adição só acontece depois de Confirmar. As cartas personalizadas sem efeito automático apenas registram a descrição, para o grupo aplicar suas próprias regras manualmente.

As escolhas de Sofra Imbecil, Destruição Mutua Assegurada, O Rei mandou e To fora dessa ficam pendentes até **Confirmar**. Quando uma carta envolve duas atribuições, o site confirma o conjunto em uma única operação; a seleção do efeito, sozinha, não altera os resultados já registrados.

### Busca, capas e notas

A busca de animes mostra **nome, capa e nota média do MyAnimeList (MAL)** quando esses dados estiverem disponíveis. Escolha a edição correta do anime antes de cadastrar, especialmente no caso de filmes, temporadas e continuações. O cadastro manual continua disponível sem vínculo com o catálogo.

A capa, o identificador do MAL e a nota média são guardados com o cadastro. A nota MAL representa o valor recebido na busca e não é atualizada automaticamente. Títulos manuais ou dados sem capa/nota exibem uma indicação de ausência, sem inventar valores.

Para notas pessoais, edite cada participante em **Nomes** e informe seu perfil, por exemplo `https://anilist.co/user/SEU-USUARIO/`. Ao sortear um anime do catálogo, a seção **Notas dos colegas**, abaixo das roletas, aparece automaticamente com **todos os nomes cadastrados**. Ela consulta a lista pública de cada colega com perfil vinculado e mostra sua nota na escala **0 a 10**, junto do status informado no AniList, como Assistindo ou Concluído. A consulta também funciona quando você gira apenas a roleta de animes, sem ter sorteado um nome. A nota pessoal é diferente da média MAL.

Colegas sem vínculo exibem **Sem perfil**. Você não precisa abrir uma seção nem selecionar um colega para carregar as notas; em caso de falha, use **Tentar notas novamente**. As notas pessoais são consultadas online, com cache curto de até 5 minutos durante a sessão, e não são uma cópia permanente no backup.

**Sem nota**, **não consta na lista pública** e **perfil/lista indisponível ou privado** são situações diferentes. O site não trata ausência de informação como prova de que alguém não assistiu. Sem perfil cadastrado, sem vínculo do anime com o catálogo ou durante uma falha do serviço, você ainda pode confirmar ou recusar o sorteio normalmente.

### Repetições e ciclos

Nos sorteios comuns, nomes e animes **não se repetem no mesmo ciclo**. Assim que uma rodada é confirmada, ambos deixam de participar dos próximos sorteios. As cartas podem se repetir. Destruição Mutua Assegurada atribui o mesmo título a duas pessoas; Sofra Imbecil troca atribuições e O Rei mandou atribui um anime a outro colega. Giros e escolhas ainda não confirmados não consomem as opções.

Os itens sorteados continuam cadastrados nas listas de edição; eles não são apagados. Quando quiser começar outro ciclo, clique em **Limpar resultados**, no cabeçalho da seção Resultados, e confirme. Os nomes e animes voltam às roletas, os Resultados do ciclo atual são limpos, e o Histórico permanece guardado. Escolhas pendentes ainda não confirmadas também são descartadas.

Para corrigir uma atribuição, use a lixeira **Excluir resultado** e confira o aviso antes de confirmar. A exclusão remove os registros afetados dos Resultados e do Histórico. Excluir a linha principal ou a adicional criada por Destruição Mutua Assegurada/O Rei mandou remove o conjunto inteiro. Trocas ou substituições posteriores que dependam do resultado excluído também são desfeitas. Atribuições anteriores que permanecerem recuperam o anime anterior. Nomes e animes cadastrados voltam a participar quando nenhum outro resultado ainda os utiliza; resultados independentes continuam guardados.

Se a atribuição excluída adicionou títulos por Infernizar, essas adições também são desfeitas quando continuam intactas e ainda não foram usadas. Títulos editados, já usados, escolhidos na rodada pendente ou presentes em outro resultado do Histórico são preservados.

O botão de som no topo ativa ou desativa os efeitos sonoros.

## Guessr

A aba **Guessr** tem quatro opções: **Livre**, **Notas diárias**, **Personagens** e **Anidle**. As duas primeiras usam avaliações dos colegas. Personagens e Anidle têm somente desafios diários, sem modo infinito.

No **Livre** e nas **Notas diárias**, descubra de qual colega são as avaliações de três animes. Cada rodada usa **3 pistas reais**, com anime, nota e status vindos da lista pública do AniList. Escolha um dos nomes do grupo como palpite. O nome e o link do perfil de origem são revelados ao terminar a rodada, para conferir os dados.

Você tem **3 tentativas por rodada**. Acertar na primeira vale **3 pontos**, na segunda **2 pontos** e na terceira **1 ponto**. Um palpite errado não pode ser repetido na mesma rodada.

Escolha **Livre** para novas rodadas a partir dos perfis vinculados ou **Notas diárias** para cinco rodadas fixas por data.

### Livre

Para uma rodada valer pontos, é necessário ter **pelo menos 2 colegas com perfis aptos**: cada perfil precisa estar público, acessível e ter ao menos **3 animes avaliados**. Cadastrar um link, sozinho, não garante que ele tenha dados suficientes para jogar.

Hex, KV, Cap, Nando, Turbo, Mary, Kris e Kyoka já vêm com seus perfis configurados, tanto nas notas pessoais das roletas quanto no Livre. Nando usa [nandolrv](https://anilist.co/user/nandolrv/). Quando pelo menos dois estiverem aptos, as rodadas valem pontos. Se apenas um perfil puder ser usado, o site oferece uma **Prévia jogável, sem pontuação**, usando três avaliações reais dele.

O Livre consulta apenas informações públicas. Entradas privadas, sem nota ou marcadas como conteúdo adulto não são usadas nas pistas; não há notas ou pistas inventadas. As capas vêm do AniList quando disponíveis. Perfis sem avaliações públicas suficientes não entram como origem de uma rodada.

As listas consultadas ficam em cache temporário na memória da sessão por **5 minutos**, limitado a **20 perfis**, para evitar consultas repetidas. Mudanças no AniList podem levar esse intervalo para aparecer. Não é necessário entrar no AniList pelo site nem fornecer senha ou chave de API.

O jogo e o placar do Livre são **locais ao navegador**. Os dados necessários para continuar a rodada, as tentativas e as estatísticas são salvos na chave local `sorteio.guessr.v1`, separada dos dados das roletas; as listas completas consultadas não são gravadas nesse salvamento. Nesse modo não há banco de dados online, partida compartilhada nem sincronização de pontuação entre os colegas. Jogar Guessr não consome os nomes ou animes das roletas.

### Notas diárias locais

Cada data tem **5 rodadas fixas**, iguais para todos os navegadores que usam esta versão do site. Cada rodada oferece três tentativas e vale 3, 2 ou 1 ponto conforme o acerto: o máximo por dia é **15 pontos**. Termine as cinco rodadas para concluir o desafio; **concluir também conta para a sequência de participação quando houver erros**.

O calendário começa em **20/10/2026** e permite escolher datas até hoje, sempre pelo fuso **America/Sao_Paulo**. Não há desafios futuros. Você pode recuperar dias anteriores para fechar lacunas na sequência. A sequência atual conta dias concluídos consecutivos e permanece ativa quando o último dia concluído é hoje ou ontem. Um desafio concluído não pode ser reiniciado nem jogado novamente; as cinco rodadas continuam disponíveis para revisão.

As pistas vêm de bases públicas fixas. A edição de **20/10/2026**, identificada por `2026-10-20-v1`, mantém os cinco perfis originais de Hex, Turbo, Mary, Kris e Kyoka em `daily-data.json`. A partir de **21/10/2026**, a edição `2026-10-21-cap-kv-v1` acrescenta os perfis reais de **Cap — CapKiyo** e **KV — knvcria**, guardados em `daily-cap.json` e `daily-kv.json`, e passa a usar sete perfis. A partir de **24/10/2026**, a edição `2026-10-24-nando-v1` acrescenta **Nando — nandolrv**, com 406 avaliações públicas em `daily-nando.json`, e passa a usar oito perfis. Os desafios até 23/10 continuam exatamente os mesmos, incluindo partidas em andamento e resultados concluídos.

O registro de edições em `spark-core.js` escolhe a base pela data do desafio e é compartilhado entre o modo local e o online. **Mantenha os quatro arquivos de dados e seus identificadores inalterados**; futuras edições precisam preservar as bases anteriores para não mudar desafios já disponíveis. As pistas do Diário não atualizam ao vivo nem dependem das listas locais. O Livre continua consultando os perfis atuais normalmente.

No modo local, o progresso, a pontuação diária e a sequência ficam somente neste navegador, na chave `sorteio.guessr.daily.v1`. Os dias já salvos são preservados ao mudar de edição, incluindo conclusões e sequência. Não entram na exportação JSON das roletas. Os arquivos `daily-core.js`, `spark-core.js`, `daily-data.json`, `daily-cap.json`, `daily-kv.json` e `daily-nando.json` são obrigatórios para esse modo.

### Personagens — desafio diário

São **4 personagens por data**. Digite o **nome do personagem** e o **anime ao qual pertence** em cada cartão. O nome e a obra valem **1 ponto cada**, até **8 pontos** por desafio. Os dois campos oferecem sugestões: a busca de personagens reconhece os nomes alternativos e a de animes reconhece títulos equivalentes. Selecione com o mouse ou com as setas e Enter; escolher uma sugestão apenas preenche o campo, sem gastar tentativa.

Você pode fazer **até 3 envios para o conjunto dos quatro cartões**, e não três envios por personagem. As respostas certas ficam marcadas e você continua tentando as partes que faltam. Ao acertar tudo ou esgotar os envios, o jogo termina e mostra as respostas. Não há modo Livre ou infinito para Personagens.

### Anidle — desafio diário

Descubra o anime do dia usando **até 22 palpites diferentes**, escolhidos nas sugestões da busca. Cada palpite compara **ano, estúdio, origem, nota, gêneros e tags** com o anime secreto. As setas indicam se o ano ou a nota da resposta são maiores ou menores. Cores e indicadores distinguem valores iguais, parciais ou diferentes.

A primeira pista aparece após **11 palpites** e mostra **formato e quantidade de episódios**. Após **17 palpites**, a capa é liberada. Acertar vale **22 pontos na primeira tentativa, 21 na segunda, até 1 na última**; terminar sem acertar vale zero. Um título já usado não pode ser enviado novamente no mesmo desafio. Não há modo Livre ou infinito para Anidle.

### Calendário e dados dos novos jogos

Personagens e Anidle começam em **20/10/2026**, seguem o fuso **America/Sao_Paulo** e têm o próprio calendário para recuperar datas passadas até hoje. Cada modo guarda o próprio progresso e a própria sequência de participação. Terminar um desafio conta para a sequência mesmo sem pontuação máxima; a sequência de um jogo não se mistura à dos outros.

O arquivo `mini-data.json` contém uma base fixa de **851 animes e 320 personagens**, com metadados públicos do AniList. Os desafios de uma mesma data são iguais para todos que usam esta versão, independentemente de quem está conectado. As respostas e características vêm dessa base, sem consulta ao AniList durante cada palpite. As imagens continuam sendo carregadas dos endereços do catálogo e precisam de internet. A nota usada pelo Anidle é a média registrada nessa base, não a avaliação pessoal dos colegas nem uma nota atualizada ao vivo.

Sem Firebase ativo, esses dois jogos guardam o progresso somente no navegador, na chave `sorteio.mini.v1`. Com a conexão configurada, entre na conta para usar o progresso sincronizado e os rankings; partidas locais antigas não são importadas automaticamente. Jogar qualquer um deles não altera as roletas, o placar Livre ou os desafios de Notas.

Preserve `mini-data.json` e seu identificador `mini-2026-10-20-v1` nas próximas atualizações. Trocar a base sem versionamento pode mudar desafios de datas já jogadas.

### Login, progresso online e rankings

Em uma primeira instalação, o arquivo `firebase-config.js` precisa receber os dados públicos do seu projeto e `enabled: true`. Se a conexão estiver desativada, as Roletas, o Livre e os desafios locais continuam disponíveis; login e ranking indicam que a configuração online está pendente. Siga o **TUTORIAL-FIREBASE-GRATUITO.md** para configurar pelo painel do Firebase, usando **Authentication e Firestore no plano Spark**, sem cartão, Cloud Functions ou publicação de servidor. Se o login já funciona, preserve esse arquivo e siga apenas o guia de atualização. O site continua no GitHub Pages.

Os logins previstos são **hex, kv, cap, nando, turbo, mary, kris, kyoka e thiago**. Contas que ainda não existirem podem ser cadastradas no painel **Authentication → Users**. Cada colega entra no site com **usuário e senha**, por exemplo `kv`, sem informar e-mail pessoal. O código transforma o usuário em um endereço técnico como `kv@usuarios.sorteio.invalid`; ele não é uma caixa de e-mail. As regras do Firestore liberam os dados apenas para as contas previstas do grupo. Os perfis do AniList continuam separados dessas contas de login.

**Thiago é um participante apenas dos jogos e rankings.** Ele pode jogar os modos do Guessr e pontuar nos desafios diários de Notas, Personagens e Anidle, sem perfil AniList. Seu nome não é acrescentado às Roletas nem às respostas do Guessr de notas. Ele aparece nos rankings dos desafios que concluir; o modo Livre mantém o placar local habitual.

Quem conhece a senha atual pode usar **Minha conta → Trocar senha**. Como os endereços técnicos não recebem mensagens, a recuperação por e-mail não funciona. Consulte no tutorial a alternativa para uma senha esquecida e suas consequências para o progresso.

Cada desafio online guarda **uma partida por conta, por jogo e por data**. Entrar na mesma conta em outro dispositivo recupera o progresso e a sequência de cada jogo. O progresso antigo salvo somente no navegador não é importado automaticamente. A pontuação é calculada no navegador e salva no Firestore: esta versão foi feita para um grupo de amigos que confia nos resultados enviados, sem verificação contra trapaça em servidor.

Na aba **Ranking**, selecione **Notas**, **Personagens** ou **Anidle** e depois o período **diário** ou **mensal**. Os rankings são separados por jogo: cada dia concluído vale até **15 pontos em Notas**, **8 em Personagens** e **22 em Anidle**. O calendário segue **America/Sao_Paulo**. Datas anteriores, inclusive de meses passados, continuam abertas; a pontuação é atribuída à data e ao mês do desafio, não ao dia em que você decidiu recuperar a partida. Os novos jogos exigem as regras atualizadas do arquivo `firebase-gratuito/firestore.rules`.

O Spark tem cotas gratuitas. O uso de um grupo pequeno tende a ficar bem abaixo delas; acompanhe o painel **Firestore → Usage**. Sem ativar faturamento, atingir uma cota pode interromper o serviço até sua renovação, em vez de gerar cobrança por excedente. Veja os [planos do Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) e as [cotas do Firestore](https://firebase.google.com/docs/firestore/quotas).

## Dados, backup e compartilhamento

As listas das Roletas, configurações, ciclo e histórico são salvos automaticamente **somente no navegador e dispositivo usados**. Abrir o mesmo link em outro navegador começa com os dados iniciais. Limpar os dados do navegador pode apagar suas alterações. Quando o Firebase está ativo, contas, partidas dos desafios online e rankings ficam no Firebase e são separados desses dados locais.

- **Exportar dados**, em Editar listas, baixa um arquivo JSON **somente das Roletas**: listas, perfis AniList vinculados, dados do catálogo salvos nos animes, configurações, estado e resultados do ciclo e histórico. O arquivo não inclui o progresso nem o placar de nenhum jogo do Guessr.
- **Importar dados** carrega um backup e substitui os dados atuais após confirmação. Exporte antes se quiser guardar a versão anterior.
- **Copiar**, na seção Resultados abaixo das roletas, copia apenas as atribuições do ciclo atual, no mesmo formato exibido na lista.
- **Copiar**, no Histórico, copia as rodadas guardadas de todos os ciclos.

**Limpar**, no Histórico, apaga o histórico e os Resultados do ciclo atual após confirmação. Nomes e animes já sorteados continuam fora das roletas até você usar Limpar resultados para começar outro ciclo.

Backups anteriores da versão 1 continuam compatíveis com a importação. Os Resultados do ciclo atual também são preservados ao fechar e reabrir o site no mesmo navegador.

Para continuar as Roletas em outro computador, envie o JSON exportado e importe-o lá. Dados salvos ao abrir o arquivo localmente não são transferidos automaticamente para a versão publicada: exporte e importe para fazer essa mudança. O progresso do Livre e dos desafios locais permanece no navegador onde foi jogado; os desafios online acompanham a conta de login.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub. Um repositório público é a opção compatível com o plano gratuito.
2. Envie **o conteúdo desta pasta para a raiz do repositório**, incluindo o arquivo oculto `.nojekyll`. O `index.html` deve ficar na raiz, e não dentro de uma pasta `otaku-roll`. Ao atualizar um site que já funciona, mantenha o `firebase-config.js` existente: ele não acompanha o ZIP `atualizacao-guessr-diarios.zip`.
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
- `daily-kv.json`: complemento fixo de knvcria, com 367 avaliações públicas para a edição de 21/10/2026.
- `daily-nando.json`: complemento fixo de nandolrv, com 406 avaliações públicas para a edição de 24/10/2026.
- `daily-cap.json`: complemento fixo de CapKiyo, usado na edição `2026-10-21-cap-kv-v1`; também deve ser preservado.
- `guessr.js`: telas dos modos Livre e Diário, registro das edições por data, consultas e armazenamento separado do Guessr.
- `mini-core.js`: regras, validação, respostas equivalentes e seleção diária de Personagens e Anidle.
- `mini-games.js`: telas, calendário, palpites e progresso dos dois novos desafios.
- `mini.css`: aparência dos cartões de personagens e da tabela de comparações do Anidle.
- `mini-data.json`: base fixa de 851 animes e 320 personagens do AniList, identificada como `mini-2026-10-20-v1`.
- `firebase-config.js`: configuração pública do seu projeto Firebase e ativação do modo online.
- `cloud-client.js`: cliente Firebase pronto para o navegador, conectado diretamente ao Authentication e ao Firestore.
- `spark-core.js`: progresso e resultados do Diário online, com proteção contra registros duplicados.
- `account.js`: entrada, troca de senha e rankings separados para Notas, Personagens e Anidle.
- `poster-placeholder.svg`: imagem usada quando a capa do anime não está disponível.
- `favicon.svg`: ícone da aba do navegador.

Alterar os dados iniciais em `core.js` afeta novas sessões sem dados salvos. Para mudar as listas do navegador atual, use Editar listas. Depois de alterar os arquivos, envie-os novamente à mesma branch para atualizar o site.
