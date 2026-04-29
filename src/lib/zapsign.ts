import prisma from './prisma';

interface ZapsignConfig {
  token: string;
  url: string;
  publicUrl: string;
}

export async function getZapsignConfig(): Promise<ZapsignConfig> {
  const config = await prisma.configuracaoSistema.findUnique({ where: { id: 1 } });
  
  if (!config || !config.zapsignToken) {
    throw new Error("API token not found. Por favor configure no Painel de Usuários.");
  }

  const publicUrl = config.urlPublica?.replace(/\/$/, '') || 'http://localhost:3000';
  const url = config.zapsignAmbiente === 'PRODUCAO' 
    ? 'https://api.zapsign.com.br/api/v1'
    : 'https://sandbox.api.zapsign.com.br/api/v1';

  return { token: config.zapsignToken, url, publicUrl };
}

export async function createTemplate(nomeEvento: string, filePath: string) {
  const config = await getZapsignConfig();
  const docxUrl = `${config.publicUrl}${filePath}`;
  
  const payload = {
    name: `Contrato de Serviço - ${nomeEvento}`,
    docx_url: docxUrl,
    lang: "pt-br",
    first_signer: {
      auth_mode: "assinaturaTela",
      blank_email: false
    }
  };

  const res = await fetch(`${config.url}/templates/create/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro na ZapSign (Template): ${errorText}`);
  }

  const data = await res.json();
  return data.token || data.template_token;
}

interface ContractData {
  nome_formando: string;
  cpf_formando: string;
  curso_formando: string;
  turma_formando: string;
  nome_responsavel: string;
  cpf_responsavel: string;
  email_responsavel: string;
  telefone_responsavel: string;
  nome_evento: string;
  data_evento: string;
  valor_contrato: string;
  data_contrato: string;
}

export async function createDocument(templateId: string, data: ContractData) {
  const config = await getZapsignConfig();

  const payload = {
    template_id: templateId,
    signer_name: data.nome_responsavel,
    lang: "pt-br",
    signers: [
      {
        name: data.nome_responsavel,
        auth_mode: "assinaturaTela",
        send_via: "link", 
      }
    ],
    data: [
      { de: "{{nome_formando}}", para: data.nome_formando },
      { de: "{{cpf_formando}}", para: data.cpf_formando },
      { de: "{{curso_formando}}", para: data.curso_formando || '' },
      { de: "{{turma_formando}}", para: data.turma_formando || '' },
      { de: "{{nome_responsavel}}", para: data.nome_responsavel },
      { de: "{{cpf_responsavel}}", para: data.cpf_responsavel },
      { de: "{{email_responsavel}}", para: data.email_responsavel || '' },
      { de: "{{telefone_responsavel}}", para: data.telefone_responsavel },
      { de: "{{nome_evento}}", para: data.nome_evento },
      { de: "{{data_evento}}", para: data.data_evento || '' },
      { de: "{{valor_contrato}}", para: data.valor_contrato },
      { de: "{{data_contrato}}", para: data.data_contrato }
    ]
  };

  const res = await fetch(`${config.url}/models/create-doc/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro na ZapSign (Create Doc): ${errorText}`);
  }

  const zapsignRes = await res.json();
  
  // O retorno do ZapSign devolve os signers. Queremos a URL de assinatura do primeiro signer (responsável).
  const signUrl = zapsignRes.signers && zapsignRes.signers.length > 0 ? zapsignRes.signers[0].sign_url : null;
  const docToken = zapsignRes.token;

  return { docToken, signUrl, raw: zapsignRes };
}
