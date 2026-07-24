const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/dashboard/layout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const desktopTarget = `{isNxtChapter ? (
                    <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-10 h-10 object-contain rounded-lg" />
                  ) : (
                    <div className="bg-[#8b7355] p-1.5 rounded-xl flex items-center justify-center">
                      <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-7 h-7 object-contain" />
                    </div>
                  )}
                  <span className={\`font-bold text-lg tracking-tight flex-1 text-left \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>{isNxtChapter ? 'NXT Chapter' : 'SOL Theory'}</span>
                  <ChevronDown className={\`w-4 h-4 text-slate-400 transition-transform duration-200 \${isOrgSwitcherOpen ? 'rotate-180' : ''}\`} />
                </button>

                {isOrgSwitcherOpen && (
                  <div className={\`absolute left-5 right-5 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 \${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-[#faf8f3] border border-[#e0ddd4]'}\`}>
                    {/* SOL Theory option */}
                    <button
                      onClick={() => {
                        setIsOrgSwitcherOpen(false);
                        if (isNxtChapter) router.push('/portal/dashboard/soltheory');
                      }}
                      className={\`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer \${!isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-[#f0ede4]') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2efe8]')}\`}
                    >
                      <div className="bg-[#8b7355] p-1.5 rounded-xl flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-7 h-7 object-contain" />
                      </div>
                      <span className={\`text-sm font-semibold flex-1 text-left \${!isNxtChapter ? (isDarkMode ? 'text-white' : 'text-stone-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}\`}>SOL Theory</span>
                      {!isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                    {/* NXT Chapter option */}
                    <button
                      onClick={() => {
                        setIsOrgSwitcherOpen(false);
                        if (!isNxtChapter) router.push('/portal/dashboard/nxtchapter');
                      }}
                      className={\`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-t \${isDarkMode ? 'border-slate-700' : 'border-slate-100'} \${isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-[#f0ede4]') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2efe8]')}\`}
                    >
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-10 h-10 object-contain rounded-lg" />
                      <span className={\`text-sm font-semibold flex-1 text-left \${isNxtChapter ? (isDarkMode ? 'text-white' : 'text-stone-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}\`}>NXT Chapter</span>
                      {isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href={dashboardHome} className={\`p-6 pt-8 pb-8 flex flex-col items-start gap-3 transition-colors cursor-pointer \${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2efe8]'}\`}>
                {isNxtChapter ? (
                  <>
                    <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-40 h-auto object-contain object-left" />
                  </>
                ) : (
                  <>
                    <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-9 h-9 object-contain" />
                    <span className={\`font-bold text-xl tracking-tight \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>SOL Theory</span>
                  </>
                )}`;

const desktopReplacement = `<div className="bg-[#8b7355] p-1.5 rounded-xl flex items-center justify-center">
                    <img src={getOrgConfig(currentOrgId)?.theme.icon} alt={\`\${getOrgLabel(currentOrgId)} Logo\`} className="w-7 h-7 object-contain" />
                  </div>
                  <span className={\`font-bold text-lg tracking-tight flex-1 text-left \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>{getOrgLabel(currentOrgId)}</span>
                  <ChevronDown className={\`w-4 h-4 text-slate-400 transition-transform duration-200 \${isOrgSwitcherOpen ? 'rotate-180' : ''}\`} />
                </button>

                {isOrgSwitcherOpen && (
                  <div className={\`absolute left-5 right-5 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 \${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-[#faf8f3] border border-[#e0ddd4]'}\`}>
                    {getAllOrgIds().map((orgId, idx) => {
                      const isCurrent = currentOrgId === orgId;
                      return (
                        <button
                          key={orgId}
                          onClick={() => {
                            setIsOrgSwitcherOpen(false);
                            if (!isCurrent) router.push(\`/portal/dashboard/\${orgId}\`);
                          }}
                          className={\`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer \${idx > 0 ? (isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-100') : ''} \${isCurrent ? (isDarkMode ? 'bg-slate-700' : 'bg-[#f0ede4]') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2efe8]')}\`}
                        >
                          <div className="bg-[#8b7355] p-1.5 rounded-xl flex items-center justify-center">
                            <img src={getOrgConfig(orgId)?.theme.icon} alt={\`\${getOrgLabel(orgId)} Logo\`} className="w-7 h-7 object-contain" />
                          </div>
                          <span className={\`text-sm font-semibold flex-1 text-left \${isCurrent ? (isDarkMode ? 'text-white' : 'text-stone-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}\`}>{getOrgLabel(orgId)}</span>
                          {isCurrent && <Check className="w-4 h-4 text-indigo-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <Link href={dashboardHome} className={\`p-6 pt-8 pb-8 flex flex-col items-start gap-3 transition-colors cursor-pointer \${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2efe8]'}\`}>
                <img src={getOrgConfig(currentOrgId)?.theme.icon} alt={\`\${getOrgLabel(currentOrgId)} Logo\`} className="w-9 h-9 object-contain" />
                <span className={\`font-bold text-xl tracking-tight \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>{getOrgLabel(currentOrgId)}</span>`;


const mobileTarget = `{isNxtChapter ? (
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-8 h-8 object-contain rounded-lg" />
                    ) : (
                      <div className="bg-[#8b7355] p-1 rounded-lg flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-6 h-6 object-contain" />
                      </div>
                    )}
                    <span className={\`font-bold text-lg tracking-tight flex-1 text-left \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>{isNxtChapter ? 'NXT Chapter' : 'SOL Theory'}</span>
                    <ChevronDown className={\`w-4 h-4 text-slate-400 transition-transform duration-200 \${isOrgSwitcherOpen ? 'rotate-180' : ''}\`} />
                  </button>

                  {isOrgSwitcherOpen && (
                    <div className={\`absolute left-4 right-4 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 \${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-[#faf8f3] border border-slate-200'}\`}>
                      {/* SOL Theory option */}
                      <button
                        onClick={() => {
                          setIsOrgSwitcherOpen(false);
                          setIsMobileMenuOpen(false);
                          if (isNxtChapter) router.push('/portal/dashboard/soltheory');
                        }}
                        className={\`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer \${!isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-indigo-50') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2ece0]')}\`}
                      >
                        <div className="bg-[#8b7355] p-1 rounded-lg flex items-center justify-center">
                          <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <span className={\`text-sm font-semibold flex-1 text-left \${!isNxtChapter ? (isDarkMode ? 'text-white' : 'text-indigo-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}\`}>SOL Theory</span>
                        {!isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                      {/* NXT Chapter option */}
                      <button
                        onClick={() => {
                          setIsOrgSwitcherOpen(false);
                          setIsMobileMenuOpen(false);
                          if (!isNxtChapter) router.push('/portal/dashboard/nxtchapter');
                        }}
                        className={\`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer \${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-100'} \${isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-indigo-50') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2ece0]')}\`}
                      >
                        <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-8 h-8 object-contain rounded-lg" />
                        <span className={\`text-sm font-semibold flex-1 text-left \${isNxtChapter ? (isDarkMode ? 'text-white' : 'text-indigo-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}\`}>NXT Chapter</span>
                        {isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href={dashboardHome} className={\`p-6 pt-6 pb-6 flex flex-col items-start gap-3 transition-colors cursor-pointer \${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2ece0]'}\`} onClick={() => setIsMobileMenuOpen(false)}>
                  {isNxtChapter ? (
                    <>
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-32 h-auto object-contain object-left" />
                    </>
                  ) : (
                    <>
                      <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-8 h-8 object-contain" />
                      <span className={\`font-bold text-xl tracking-tight \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>SOL Theory</span>
                    </>
                  )}`;

const mobileReplacement = `<div className="bg-[#8b7355] p-1 rounded-lg flex items-center justify-center">
                      <img src={getOrgConfig(currentOrgId)?.theme.icon} alt={\`\${getOrgLabel(currentOrgId)} Logo\`} className="w-6 h-6 object-contain" />
                    </div>
                    <span className={\`font-bold text-lg tracking-tight flex-1 text-left \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>{getOrgLabel(currentOrgId)}</span>
                    <ChevronDown className={\`w-4 h-4 text-slate-400 transition-transform duration-200 \${isOrgSwitcherOpen ? 'rotate-180' : ''}\`} />
                  </button>

                  {isOrgSwitcherOpen && (
                    <div className={\`absolute left-4 right-4 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 \${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-[#faf8f3] border border-slate-200'}\`}>
                      {getAllOrgIds().map((orgId, idx) => {
                        const isCurrent = currentOrgId === orgId;
                        return (
                          <button
                            key={orgId}
                            onClick={() => {
                              setIsOrgSwitcherOpen(false);
                              setIsMobileMenuOpen(false);
                              if (!isCurrent) router.push(\`/portal/dashboard/\${orgId}\`);
                            }}
                            className={\`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer \${idx > 0 ? (isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-100') : ''} \${isCurrent ? (isDarkMode ? 'bg-slate-700' : 'bg-indigo-50') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2ece0]')}\`}
                          >
                            <div className="bg-[#8b7355] p-1 rounded-lg flex items-center justify-center">
                              <img src={getOrgConfig(orgId)?.theme.icon} alt={\`\${getOrgLabel(orgId)} Logo\`} className="w-6 h-6 object-contain" />
                            </div>
                            <span className={\`text-sm font-semibold flex-1 text-left \${isCurrent ? (isDarkMode ? 'text-white' : 'text-indigo-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}\`}>{getOrgLabel(orgId)}</span>
                            {isCurrent && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link href={dashboardHome} className={\`p-6 pt-6 pb-6 flex flex-col items-start gap-3 transition-colors cursor-pointer \${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2ece0]'}\`} onClick={() => setIsMobileMenuOpen(false)}>
                  <img src={getOrgConfig(currentOrgId)?.theme.icon} alt={\`\${getOrgLabel(currentOrgId)} Logo\`} className="w-8 h-8 object-contain" />
                  <span className={\`font-bold text-xl tracking-tight \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>{getOrgLabel(currentOrgId)}</span>`;


content = content.replace(desktopTarget, desktopReplacement);
content = content.replace(mobileTarget, mobileReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('done replacing layout.tsx');
