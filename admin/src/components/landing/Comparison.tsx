import { Check, X } from 'lucide-react';

const features = [
  { name: 'Embeddable Widget', cv: true, uservoice: true, canny: true },
  { name: 'AI Deduplication', cv: true, uservoice: false, canny: false },
  { name: 'Self-Hosted Option', cv: true, uservoice: false, canny: false },
  { name: 'MCP Integration', cv: true, uservoice: false, canny: false },
  { name: 'Starting Price', cv: '$0/mo', uservoice: '$699/mo', canny: '$79/mo' },
];

export default function Comparison() {
  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Why teams choose Collective Vision
          </h2>
          <p className="text-xl text-gray-400">
            More features, better pricing, built for the AI era
          </p>
        </div>

        <div className="bg-[#141414] rounded-2xl overflow-hidden card-glow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-4 px-6 text-gray-400 font-medium">
                    Feature
                  </th>
                  <th className="text-center py-4 px-6">
                    <div className="font-semibold text-white">
                      Collective Vision
                    </div>
                    <div className="text-sm text-blue-500 mt-1">Us</div>
                  </th>
                  <th className="text-center py-4 px-6 text-gray-400">
                    UserVoice
                  </th>
                  <th className="text-center py-4 px-6 text-gray-400">Canny</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-800 last:border-0"
                  >
                    <td className="py-4 px-6 text-white font-medium">
                      {feature.name}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {typeof feature.cv === 'boolean' ? (
                        feature.cv ? (
                          <Check className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-600 mx-auto" />
                        )
                      ) : (
                        <span className="text-blue-500 font-semibold">
                          {feature.cv}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {typeof feature.uservoice === 'boolean' ? (
                        feature.uservoice ? (
                          <Check className="h-5 w-5 text-gray-500 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-700 mx-auto" />
                        )
                      ) : (
                        <span className="text-gray-400">{feature.uservoice}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {typeof feature.canny === 'boolean' ? (
                        feature.canny ? (
                          <Check className="h-5 w-5 text-gray-500 mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-gray-700 mx-auto" />
                        )
                      ) : (
                        <span className="text-gray-400">{feature.canny}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
