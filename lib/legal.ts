/*
 * Legal documents, ported VERBATIM from the live WordPress site
 * (privacy-policy, terms-and-conditions, refund-policy) with
 * typographic normalization only (no em or en dashes). FLAG: the live
 * legal copy names "Motion Magic Production LLC" / "Magic Motion
 * Production LLC" as the operating entity while the new brand line is
 * "A brand of Vidiosa LLC". Shariful's counsel must reconcile the
 * entity references before launch; do not edit them in code.
 */

export type LegalItem = { t: "p" | "li"; text: string };
export type LegalSection = { h: string; items: LegalItem[] };
export type LegalDoc = {
  title: string;
  effective: string;
  sections: LegalSection[];
};

export const legalDocs: Record<string, LegalDoc> = {
  "privacy": {
    "title": "Privacy Policy",
    "effective": "Effective Date: January 5th, 2025",
    "sections": [
      {
        "h": "",
        "items": [
          {
            "t": "p",
            "text": "Your privacy is important to us. This Privacy Policy explains how GHL Video (operated by Magic Motion Production LLC as a DBA) collects, uses, discloses, and protects your information when you interact with our website (ghlvideo.com) or engage with our services. By accessing our website and using our services, you consent to the collection and use of your information in accordance with this Privacy Policy."
          }
        ]
      },
      {
        "h": "1. Information We Collect",
        "items": [
          {
            "t": "p",
            "text": "We collect both personal and non-personal information to provide and improve our services. This includes:"
          },
          {
            "t": "li",
            "text": "Personal Information: Your name, email address, phone number, business name, and billing address. This information is provided voluntarily when you fill out forms, make inquiries, or enter into agreements with us."
          },
          {
            "t": "li",
            "text": "Production-Related Information: Project briefs, brand assets, feedback, scripts, and any other data necessary for the execution of your video content."
          }
        ]
      },
      {
        "h": "2. Use of Information",
        "items": [
          {
            "t": "p",
            "text": "We use the collected information to:"
          },
          {
            "t": "li",
            "text": "Provide and deliver our video production services"
          },
          {
            "t": "li",
            "text": "Communicate with clients and respond to inquiries"
          },
          {
            "t": "li",
            "text": "Manage projects, payments, and customer accounts"
          },
          {
            "t": "li",
            "text": "Analyze website usage and improve site functionality"
          },
          {
            "t": "li",
            "text": "Comply with legal obligations and enforce our policies"
          },
          {
            "t": "p",
            "text": "We ensure that your data is used only for legitimate business purposes and is never shared for marketing or advertising without your explicit consent."
          }
        ]
      },
      {
        "h": "3. Cookies and Tracking Technologies",
        "items": [
          {
            "t": "p",
            "text": "Our website uses cookies and similar technologies to enhance your browsing experience. Cookies help us remember user preferences, analyze site performance, and improve navigation. You may disable cookies through your browser settings, but doing so may affect certain features of our website."
          }
        ]
      },
      {
        "h": "4. Information Sharing and Disclosure",
        "items": [
          {
            "t": "p",
            "text": "We do not sell, rent, or trade your personal information to third parties. We may share your information with trusted service providers who assist us in operating our website, conducting our business, or delivering services. These third parties are contractually obligated to maintain the confidentiality and security of your data. We may also disclose your information when required by law or to protect our legal rights."
          }
        ]
      },
      {
        "h": "5. Data Security",
        "items": [
          {
            "t": "p",
            "text": "We implement appropriate technical and organizational measures to safeguard your personal information from unauthorized access, alteration, disclosure, or destruction. This includes secure servers, encryption protocols, and restricted access to sensitive data. While we strive to protect your information, no method of transmission over the Internet is 100% secure."
          }
        ]
      },
      {
        "h": "6. Data Retention",
        "items": [
          {
            "t": "p",
            "text": "We retain personal and project-related data only for as long as necessary to fulfill contractual obligations and comply with legal requirements. Once data is no longer needed, it is securely deleted or anonymized. Clients may request data deletion at any time, subject to applicable legal or contractual constraints."
          }
        ]
      },
      {
        "h": "7. Your Privacy Rights",
        "items": [
          {
            "t": "p",
            "text": "You have the right to access, correct, update, or delete your personal information. You may also withdraw your consent or object to certain data uses. To exercise these rights, please contact us at hi@ghlvideo.com. We will respond to your request in accordance with applicable privacy laws."
          }
        ]
      },
      {
        "h": "8. Third-Party Links",
        "items": [
          {
            "t": "p",
            "text": "Our website may contain links to third-party sites. These sites have their own privacy policies and we do not accept any responsibility or liability for their content or practices. We encourage users to read the privacy policies of each site they visit."
          }
        ]
      },
      {
        "h": "9. Children's Privacy",
        "items": [
          {
            "t": "p",
            "text": "Our services are not intended for use by individuals under the age of 13. We do not knowingly collect personal data from children. If we learn that we have collected information from a child, we will take immediate steps to delete it."
          }
        ]
      },
      {
        "h": "10. Policy Updates and Revisions",
        "items": [
          {
            "t": "p",
            "text": "We reserve the right to update this Privacy Policy at any time to reflect changes in our practices or legal requirements. Any updates will be posted on this page with the effective date clearly indicated. Continued use of our services after changes are posted constitutes your acceptance of the revised policy."
          }
        ]
      },
      {
        "h": "11. SMS Communications",
        "items": [
          {
            "t": "p",
            "text": "By providing your phone number and checking the consent boxes on our forms, you agree to receive SMS messages from GHL Video (operated by Magic Motion Production LLC) for service-related communications such as appointment reminders, project updates, and customer support, as well as marketing or promotional messages if you have opted in separately."
          },
          {
            "t": "p",
            "text": "Standard message and data rates may apply. Message frequency may vary depending on your interaction with our services. You may opt out of SMS communications at any time by replying STOP or OUT. For assistance, reply HELP or contact us at hi@ghlvideo.com."
          },
          {
            "t": "p",
            "text": "We do not sell, rent, or share your phone number with third parties for marketing purposes."
          }
        ]
      },
      {
        "h": "12. Contact Us",
        "items": [
          {
            "t": "p",
            "text": "If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:"
          },
          {
            "t": "p",
            "text": "Motion Magic Production LLC. Email: hi@ghlvideo.com. Website: www.ghlvideo.com"
          }
        ]
      }
    ]
  },
  "terms": {
    "title": "Terms and Conditions",
    "effective": "Effective Date: January 5th, 2025",
    "sections": [
      {
        "h": "",
        "items": [
          {
            "t": "p",
            "text": "Welcome to ghlvideo.com, a service operated by Motion Magic Production LLC (\"Company,\" \"we,\" \"our,\" or \"us\"), a registered business in the United States. This document outlines the terms and conditions governing the use of our website and services. By accessing our website or using any of our services, you agree to be legally bound by these Terms and Conditions. If you do not agree with these terms, please refrain from using our website and services."
          }
        ]
      },
      {
        "h": "1. Overview of Services",
        "items": [
          {
            "t": "p",
            "text": "Motion Magic Production LLC provides professional video production services tailored to the needs of businesses. These services include, but are not limited to, conceptualizing video ideas, writing scripts, editing, adding motion graphics and animations, recording voice-overs, and delivering final video products in various formats. Our Video-as-a-Service (VaaS) offering allows businesses to integrate ongoing video content production into their broader marketing and product strategies. All services are customized based on client requirements and are governed by project-specific agreements."
          }
        ]
      },
      {
        "h": "2. Eligibility to Use Our Services",
        "items": [
          {
            "t": "p",
            "text": "To be eligible to use our services, you must be at least 18 years of age and have the legal capacity to enter into binding agreements. By engaging with our website or services, you represent and warrant that all information you provide is accurate, complete, and current. You also agree not to use our services for any unlawful or unauthorized purpose, or in any manner that could damage, disable, overburden, or impair our systems or networks."
          }
        ]
      },
      {
        "h": "3. Client Responsibilities and Cooperation",
        "items": [
          {
            "t": "p",
            "text": "Clients are expected to participate actively in the creative and production process by providing timely and accurate information, feedback, and approvals. This includes sharing branding materials (e.g., logos, colors, guidelines), scheduling necessary meetings, and responding to inquiries. It is the client's responsibility to ensure that all content and materials provided to us do not infringe on the intellectual property rights of any third parties. Failure to cooperate or provide required materials on time may result in delays, additional charges, or termination of the agreement."
          }
        ]
      },
      {
        "h": "4. Payments, Fees, and Billing Terms",
        "items": [
          {
            "t": "p",
            "text": "All payments for our services are subject to the pricing structure outlined in the service agreement or invoice. Clients are expected to make payments in full and on time, using approved payment methods such as credit cards, bank transfers, or online payment platforms. Late payments may incur additional fees, interest, or project delays. We reserve the right to suspend or terminate services in the event of non-payment. A project may only commence or continue after receipt of agreed-upon deposits or milestone payments, as specified in the contract."
          }
        ]
      },
      {
        "h": "5. Ownership and Intellectual Property",
        "items": [
          {
            "t": "p",
            "text": "Unless otherwise agreed in writing, Motion Magic Production LLC retains full ownership of all raw project files, footage, templates, and source materials used in the production process. Upon full payment of the project, the client is granted a non-exclusive, non-transferable license to use the final deliverables for their intended purpose. This license does not grant rights to resell, sublicense, or commercially distribute the content to third parties without prior written consent. Unauthorized use or reproduction of our content is strictly prohibited and may result in legal action."
          }
        ]
      },
      {
        "h": "6. Revisions, Edits, and Approval Process",
        "items": [
          {
            "t": "p",
            "text": "Each video project includes a specified number of revision rounds as defined in the agreement. Revisions refer to reasonable changes such as text edits, timing adjustments, and minor graphic modifications. Major changes, including significant content overhauls or re-shoots, may incur additional charges. Clients are expected to provide feedback and approvals within designated timeframes to ensure timely project completion. Delays in feedback may extend delivery schedules and affect our ability to meet agreed deadlines."
          }
        ]
      },
      {
        "h": "7. Satisfaction Guarantee and Refund Policy",
        "items": [
          {
            "t": "p",
            "text": "We strive to deliver high-quality video content tailored to your needs. If you are not satisfied with the final deliverable, you are entitled to request a refund within Three (3) calendar days of receiving the completed project. Refund requests must be submitted in writing, with a clear explanation of the dissatisfaction. Refunds will not be granted if the content has been publicly published or distributed. Approved refunds will be processed within 7 to 14 business days. We reserve the right to review each case individually and determine eligibility based on our internal policies. To learn more, please read our full refund policy."
          }
        ]
      },
      {
        "h": "8. Termination of Services",
        "items": [
          {
            "t": "p",
            "text": "We reserve the right to terminate or suspend service to any client who violates these terms, fails to pay agreed fees, or engages in abusive or inappropriate conduct. In the event of termination, any content or work completed up to that point will be delivered, and the client may be billed for all work performed to date. Termination does not absolve the client from any outstanding payment obligations."
          }
        ]
      },
      {
        "h": "9. Limitations of Liability",
        "items": [
          {
            "t": "p",
            "text": "To the fullest extent permitted by law, Motion Magic Production LLC and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of revenue, profits, or data, arising from your use of our services. Our total liability for any claim arising out of or related to these terms or services shall not exceed the total fees paid by the client for the specific project giving rise to the claim."
          }
        ]
      },
      {
        "h": "10. Indemnification",
        "items": [
          {
            "t": "p",
            "text": "You agree to indemnify, defend, and hold harmless Motion Magic Production LLC, its directors, employees, agents, and partners from any claims, damages, losses, liabilities, costs, or expenses (including legal fees) arising out of or related to your use of our services, your breach of these terms, or any violation of applicable laws or third-party rights."
          }
        ]
      },
      {
        "h": "11. SMS/Text Messaging Terms",
        "items": [
          {
            "t": "p",
            "text": "By providing your phone number during a form submission, booking, or communication with GHL Video (operated by Magic Motion Production LLC), and by checking the applicable consent boxes, you agree to receive SMS/text messages from us. These messages may include:"
          },
          {
            "t": "p",
            "text": "-"
          },
          {
            "t": "p",
            "text": "Service-related notifications (e.g., appointment reminders, video delivery updates, customer support)"
          },
          {
            "t": "p",
            "text": "-"
          },
          {
            "t": "p",
            "text": "Marketing or promotional content (only if you have opted in separately)"
          },
          {
            "t": "p",
            "text": "Message frequency varies based on your interactions with us. Standard message and data rates may apply depending on your carrier plan. Consent to receive messages is not a condition of purchase or use of our services. You may opt out at any time by replying STOP or OUT, and you may request assistance by replying HELP or contacting us at hi@ghlvideo.com."
          },
          {
            "t": "p",
            "text": "We do not share, rent, or sell your phone number to third parties for marketing purposes."
          }
        ]
      },
      {
        "h": "12. Modifications to Terms",
        "items": [
          {
            "t": "p",
            "text": "We may revise these Terms and Conditions at any time without prior notice. Any changes will be posted on this page, and the effective date will be updated accordingly. It is your responsibility to review these terms periodically. Continued use of our services after changes are made constitutes your acceptance of the updated terms."
          }
        ]
      },
      {
        "h": "13. Contact Information",
        "items": [
          {
            "t": "p",
            "text": "For any questions, concerns, or legal notices regarding these Terms, please contact us at:"
          },
          {
            "t": "p",
            "text": "Motion Magic Production LLC. Email: hi@ghlvideo.com. Website: www.ghlvideo.com"
          }
        ]
      }
    ]
  },
  "refund": {
    "title": "Refund Policy",
    "effective": "Effective Date: January 5th, 2025",
    "sections": [
      {
        "h": "",
        "items": [
          {
            "t": "p",
            "text": "At Motion Magic Production LLC, we are committed to delivering high-quality video content and a smooth client experience. This Refund Policy outlines the circumstances under which a client may request a refund for services purchased via ghlvideo.com."
          },
          {
            "t": "p",
            "text": "We offer two types of services:"
          },
          {
            "t": "li",
            "text": "Premade Videos Customized with Client Branding"
          },
          {
            "t": "li",
            "text": "Fully Custom Video Production"
          },
          {
            "t": "p",
            "text": "Each is covered under our fair refund approach detailed below."
          }
        ]
      },
      {
        "h": "1. Premade Video with Custom Branding",
        "items": [
          {
            "t": "p",
            "text": "Our premade video service offers clients access to pre-created templates that are then tailored with their brand elements such as logo, text, and colors. These videos are showcased in advance so clients know exactly what they are getting."
          }
        ]
      },
      {
        "h": "Refund Eligibility:",
        "items": [
          {
            "t": "li",
            "text": "Although clients preview the base video before purchase, we acknowledge there may be rare cases where the final branded output does not meet minimum professional standards."
          },
          {
            "t": "li",
            "text": "If a client believes we have failed to deliver the promised quality or if we are unable to deliver the final branded video, they may request a refund."
          },
          {
            "t": "li",
            "text": "The refund request must be made within three (3) calendar days of receiving the final video."
          }
        ]
      },
      {
        "h": "Ineligible for Refund:",
        "items": [
          {
            "t": "li",
            "text": "Refunds will not be granted for subjective preferences such as changes of mind, alternate aesthetic choices, or minor differences in interpretation."
          },
          {
            "t": "li",
            "text": "Any video that has been published, downloaded, or used commercially is not eligible for refund."
          }
        ]
      },
      {
        "h": "2. Full Custom Video Production",
        "items": [
          {
            "t": "p",
            "text": "Our custom video services involve close collaboration between our team and the client. These projects are built from the ground up, often involving scriptwriting, voice-over, filming, animation, and more."
          }
        ]
      },
      {
        "h": "Refund Eligibility:",
        "items": [
          {
            "t": "li",
            "text": "Clients receive progress updates and previews at various milestones."
          },
          {
            "t": "li",
            "text": "If, after providing input during the process, the client still finds that we have failed to deliver the final agreed product, or the quality does not meet basic professional standards, they may request a refund."
          },
          {
            "t": "li",
            "text": "The refund request must be made within three (3) calendar days of the final delivery."
          }
        ]
      },
      {
        "h": "Limitations:",
        "items": [
          {
            "t": "li",
            "text": "Refunds are not issued based on creative preferences if the delivered content aligns with approved scripts or feedback."
          },
          {
            "t": "li",
            "text": "No refund is available for projects that have been finalized and publicly used, broadcasted, or published."
          }
        ]
      },
      {
        "h": "3. How to Request a Refund",
        "items": [
          {
            "t": "p",
            "text": "To initiate a refund request:"
          },
          {
            "t": "li",
            "text": "Contact us at hi@gethighlevelvideo.com within three (3) days of receiving the final deliverable."
          },
          {
            "t": "li",
            "text": "Include your full name, project title, order details, and a clear explanation of why you believe the service failed to meet expectations."
          },
          {
            "t": "li",
            "text": "Our team will review your case within 7 business days and notify you of the decision."
          },
          {
            "t": "p",
            "text": "If your request is approved, the refund will be processed using your original method of payment within 7 to 14 business days."
          }
        ]
      },
      {
        "h": "4. Final Notes",
        "items": [
          {
            "t": "p",
            "text": "We are dedicated to making things right. However, because of the time and resources invested in every video production, we evaluate every refund request fairly but firmly. By engaging our services, you agree to this Refund Policy in full."
          },
          {
            "t": "p",
            "text": "For any questions or clarification, please reach out to us:"
          },
          {
            "t": "p",
            "text": "Motion Magic Production LLC. Email: hi@ghlvideo.com. Website: www.ghlvideo.com"
          }
        ]
      }
    ]
  }
};
