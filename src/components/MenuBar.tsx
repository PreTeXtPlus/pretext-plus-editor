export interface MenuBarProps {
    isChecked: boolean;
    onChange: () => void;
    title?: string;
    onTitleChange?: (value: string) => void;
    onSaveButton?: () => void;
    saveButtonLabel?: string;
    onCancelButton?: () => void;
    cancelButtonLabel?: string;
}

const MenuBar = (props: MenuBarProps) => {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-100 border-b border-gray-300">
          <div className="left-side flex items-center space-x-4">
            {props.title !== undefined && props.onTitleChange && (
                <label className="inline-block font-semibold pr-4">
                    Title{' '}
                    <input
                        className="w-[40vw] p-2 inline-block shadow-sm rounded-md border font-mono border-gray-400 focus:outline-blue-600"
                        type='text'
                        value={props.title}
                        onChange={(e) => props.onTitleChange?.(e.target.value)}
                    />
                </label>
            )}
            </div>
            <div className="right-side flex items-center space-x-4">

            {props.onSaveButton && (
                <button
                className="w-full sm:w-auto rounded-md px-3.5 py-2.5 !bg-green-600 hover:!bg-green-700 !text-white inline-block font-medium cursor-pointer"
                onClick={props.onSaveButton}>{props.saveButtonLabel || 'Save'}</button>
            )}
            {props.onCancelButton && (
                <button
                className="w-full sm:w-auto rounded-md px-3.5 py-2.5 !bg-gray-300 hover:!bg-gray-400 !text-black inline-block font-medium cursor-pointer ml-4"
                onClick={props.onCancelButton}>{props.cancelButtonLabel || 'Cancel'}</button>
            )}
            <label className='relative inline-flex cursor-pointer select-none items-center flex-col'>
                <input
                    type='checkbox'
                    checked={!props.isChecked}
                    onChange={props.onChange}
                    className='sr-only'
                />
                <div className='flex items-center gap-2'>
                    <span className='label flex items-center justify-center text-sm font-medium w-14'>
                        Simple
                    </span>
                    <span
                        className={`slider flex h-6 w-[48px] items-center rounded-full p-1 duration-200 ${
                            props.isChecked ? 'bg-[#212b36]' : 'bg-[#CCCCCE]'
                        }`}
                    >
                        <span
                            className={`dot h-4 w-4 rounded-full bg-white duration-200 ${
                                props.isChecked ? 'translate-x-[20px]' : ''
                            }`}
                        ></span>
                    </span>
                    <span className='label flex items-center justify-center text-sm font-medium w-14'>
                        Full
                    </span>
                </div>
                <span className='mt-1 text-xs font-medium text-gray-600 text-center'>Preview Mode</span>
                <input
                    type='checkbox'
                    checked={props.isChecked}
                    onChange={props.onChange}
                    className='sr-only'
                />
            </label>
        </div>
        </div>
    )
}

export default MenuBar
