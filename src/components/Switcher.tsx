interface SwitcherProps {
    isChecked: boolean;
    onChange: (value: any) => void;
}

const Switcher = ({ 
    isChecked,
    onChange
}:SwitcherProps) => {

  return (
    <>
      <label className='relative inline-flex cursor-pointer select-none items-center'>
        <input
          type='checkbox'
          checked={!isChecked}
          onChange={onChange}
          className='sr-only'
        />
        <span className='label flex items-center text-sm font-medium text-black'>
          Simplified
        </span>
        <span
          className={`slider mx-4 flex h-8 w-[60px] items-center rounded-full p-1 duration-200 ${
            isChecked ? 'bg-[#212b36]' : 'bg-[#CCCCCE]'
          }`}
        >
          <span
            className={`dot h-6 w-6 rounded-full bg-white duration-200 ${
              isChecked ? 'translate-x-[28px]' : ''
            }`}
          ></span>
        </span>
        <span className='label flex items-center text-sm font-medium text-black'>
          Full
        </span>
        <input
          type='checkbox'
          checked={isChecked}
          onChange={onChange}
          className='sr-only'
        />
      </label>
    </>
  )
}

export default Switcher
