# Sorteio

Um clube de anime com três roletas editáveis: **amigo → carta especial → anime da semana**. Site estático em português, pronto para GitHub Pages, sem instalação, conta no site, servidor próprio ou etapa de compilação.

## Testar no computador

Extraia todos os arquivos para a mesma pasta e abra `index.html` em um navegador atualizado. Mantenha `styles.css`, `core.js`, `catalog.js`, `app.js`, `poster-placeholder.svg` e `favicon.svg` junto dele. Não é necessário instalar Node.js ou outras ferramentas. As roletas e a edição manual funcionam sem consultas externas; busca, capas remotas e notas pessoais precisam de internet.

## Usar com o grupo

1. Abra **Editar listas**, no ícone de edição do topo, ou **Editar** em uma das roletas.
2. Na aba **Nomes**, adicione, edite ou remova os participantes. Se quiser consultar notas pessoais, informe também o link do perfil público de cada amigo no AniList; esse campo é opcional.
3. Na aba **Cartas**, adicione os nomes e as descrições dos efeitos e das penalidades. Para jogar sem regra extra, você pode cadastrar uma carta chamada Sem efeito.
4. Na aba **Animes**, busque um título no catálogo ou cadastre-o manualmente. Selecione o resultado desejado, escolha quem indicou e finalize em **Adicionar** ou **Salvar alteração**, ao editar. Cada amigo pode ter até **2 indicações**; também é possível cadastrar títulos sem indicação.
5. Clique em **Girar tudo** para girar as três roletas na sequência. Também é possível usar os botões **Girar** de **Nomes**, **Cartas** e **Animes** individualmente.
6. Confira o anime sorteado. Com as três escolhas completas, clique em **Confirmar**, abaixo da roleta de animes, para registrar a rodada em **Resultados**. Só então o nome e o anime saem das opções disponíveis do ciclo.
7. Se quiser outro anime, clique em **Não, girar outro**. O nome e a carta permanecem, e apenas o anime é sorteado novamente. Confira a nova escolha antes de confirmar.
8. Depois de confirmar, clique em **Girar tudo** para sortear o próximo colega. Consulte as rodadas anteriores em **Histórico**, no ícone de relógio do topo.

Antes de completar as três escolhas, você pode refazer um giro individual. Com as três prontas, os giros de nomes e cartas ficam bloqueados enquanto você decide se confirma o anime ou pede outro. As escolhas pendentes continuam no mesmo estado ao fechar e reabrir o site; reabrir não confirma a rodada.

Recusar um anime não o consome. Se houver outra opção disponível, o título recusado fica fora do giro imediatamente seguinte, mas pode aparecer em rodadas futuras. Se só houver um anime disponível, adicione outro ou use **Girar** para sortear novamente o único título.

Os Resultados mostram as atribuições do ciclo atual na ordem em que aconteceram, no formato **Nome — Anime (efeito da carta)**. Quando a carta não tiver descrição, aparece o nome dela entre parênteses. Use **Copiar**, na seção Resultados, para levar essa lista ao grupo.

Os participantes iniciais são **Hex, KV, Cap, Nando, Turbo, Mary e Kris**. As listas de **Cartas e Animes começam vazias**. Cadastre pelo menos uma carta e um anime para completar um sorteio; depois adicione as indicações e as regras do seu grupo. A atualização também remove os conjuntos antigos de exemplos quando ainda estão intactos, preservando as personalizações.

As cartas são regras combinadas entre vocês. O site sorteia e registra o texto da carta; trocas de anime, episódios extras e outras consequências são aplicados manualmente pelo grupo.

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

O botão de som no topo ativa ou desativa os efeitos sonoros.

## Dados, backup e compartilhamento

As listas, configurações, ciclo e histórico são salvos automaticamente **somente no navegador e dispositivo usados**. O site não usa um banco de dados compartilhado, login ou sincronização entre amigos. Abrir o mesmo link em outro navegador começa com os dados iniciais. Limpar os dados do navegador pode apagar suas alterações.

- **Exportar dados**, em Editar listas, baixa um arquivo JSON com listas, perfis AniList vinculados, dados do catálogo salvos nos animes, configurações, estado e resultados do ciclo e histórico.
- **Importar dados** carrega um backup e substitui os dados atuais após confirmação. Exporte antes se quiser guardar a versão anterior.
- **Copiar**, na seção Resultados abaixo das roletas, copia apenas as atribuições do ciclo atual, no mesmo formato exibido na lista.
- **Copiar**, no Histórico, copia as rodadas guardadas de todos os ciclos.

**Limpar**, no Histórico, apaga o histórico e os Resultados do ciclo atual após confirmação. Nomes e animes já sorteados continuam fora das roletas até você usar Limpar resultados para começar outro ciclo.

Backups anteriores da versão 1 continuam compatíveis com a importação. Os Resultados do ciclo atual também são preservados ao fechar e reabrir o site no mesmo navegador.

Para continuar em outro computador, envie o JSON exportado e importe-o lá. Dados salvos ao abrir o arquivo localmente não são transferidos automaticamente para a versão publicada: exporte e importe para fazer essa mudança.

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
- `poster-placeholder.svg`: imagem usada quando a capa do anime não está disponível.
- `favicon.svg`: ícone da aba do navegador.

Alterar os dados iniciais em `core.js` afeta novas sessões sem dados salvos. Para mudar as listas do navegador atual, use Editar listas. Depois de alterar os arquivos, envie-os novamente à mesma branch para atualizar o site.
