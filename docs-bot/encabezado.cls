\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{encabezado}[2026/02/27 Clase para documentos STRATIUM]

\LoadClass[a4paper,11pt]{article}

\usepackage[spanish]{babel}
\usepackage[utf8]{inputenc}

\usepackage[left=2.5cm, right=2cm, top=6cm, bottom=2.5cm, headheight=4.5cm, headsep=0.5cm]{geometry}
\usepackage{tabularx}
\usepackage{fancyhdr}
\usepackage{graphicx}
\usepackage{array}
\usepackage{multirow}
\usepackage{setspace}
\usepackage{enumitem}


\setstretch{1.15}


\spaceskip=0.45em plus 0.18em minus 0.1em


\setlength{\parskip}{4pt plus 1pt minus 1pt}


\setlist{itemsep=3pt, parsep=2pt, topsep=4pt}
\setlist[enumerate]{itemsep=3pt, parsep=2pt, topsep=4pt}


\newcolumntype{C}{>{\centering\arraybackslash}X}
\newcolumntype{M}[1]{>{\centering\arraybackslash}m{#1}}

\pagestyle{fancy}
\fancyhf{}

\renewcommand{\headrulewidth}{0pt} 

\newcommand{\generarEncabezado}[6]{
    \fancyhead[C]{
        \footnotesize
        \begin{tabular}{|M{3.5cm}|>{\centering\arraybackslash}m{7.3cm}|M{5.5cm}|}
            \hline
            \multirow{4}{*}{\includegraphics[width=3cm, height=2.5cm, keepaspectratio]{picture/logo.png}} & 
            \multirow{2}{7.3cm}[-0.45cm]{\centering\textbf{STRATIUM -- DESARROLLO DE SOFTWARE}} & 
            \rule{0pt}{0.9cm}\textbf{CÓDIGO:} #1 \\ \cline{3-3}
            & & \rule{0pt}{0.9cm}\textbf{VERSIÓN:} #2 \\ \cline{2-3}
            & \rule{0pt}{0.9cm}\textbf{PROCESO:} #3 & \textbf{ELABORACIÓN:} #4 \\ \cline{2-3}
            & \rule{0pt}{0.9cm}\textbf{#5} & \textbf{ÚLTIMA REVISIÓN:} #6 \\ \hline
        \end{tabular}
    }
    \fancyfoot[C]{\thepage}
}