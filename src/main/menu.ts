import { app, Menu, type MenuItemConstructorOptions } from 'electron';

/** 한국어 메뉴. macOS에서는 '편집' 메뉴가 있어야 복사·붙여넣기 단축키가 동작한다. */
export function installKoreanMenu(isMac: boolean, devTools: boolean): void {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about', label: `${app.name} 정보` },
              { type: 'separator' },
              { role: 'hide', label: '숨기기' },
              { role: 'hideOthers', label: '다른 앱 숨기기' },
              { role: 'unhide', label: '모두 보기' },
              { type: 'separator' },
              { role: 'quit', label: '끝내기' },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: '파일',
      submenu: [isMac ? { role: 'close', label: '창 닫기' } : { role: 'quit', label: '끝내기' }],
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' },
        { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '잘라내기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '모두 선택' },
      ],
    },
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '화면 새로 고침' },
        ...(devTools ? ([{ role: 'toggleDevTools', label: '개발자 도구' }] as MenuItemConstructorOptions[]) : []),
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
      ],
    },
    {
      label: '창',
      submenu: [
        { role: 'minimize', label: '최소화' },
        { role: 'zoom', label: '확대/축소' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
